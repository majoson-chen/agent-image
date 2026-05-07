import type { StepResult, ToolSet } from 'ai'
import 'server-only'

interface UIMessagePart { type: string, [key: string]: unknown }

function toolCallIdOf(part: UIMessagePart): string | undefined {
    const id = (part as { toolCallId?: string }).toolCallId
    return typeof id === 'string' ? id : undefined
}

/** 同一步内工具执行回写前，去掉同 toolCallId 的挂起 part，避免 approval-responded/input-available 与 output-available 重复 */
function withoutPriorToolInvocation(parts: UIMessagePart[], toolCallId: string): UIMessagePart[] {
    return parts.filter((p) => {
        const t = p.type
        if (typeof t === 'string' && t.startsWith('tool-') && toolCallIdOf(p) === toolCallId)
            return false
        return true
    })
}

/** step.response.messages 中的 tool message 最小结构 */
interface ToolResultMessage {
    role: 'tool'
    content: Array<{
        type: 'tool-result'
        toolCallId: string
        toolName: string
        output: { type: string, value?: unknown, reason?: string }
    }>
}

type ResponseMessageLike = ToolResultMessage | { role: string }

/**
 * 把一个 StepResult 的 content 追加到 UIMessage parts 数组（纯函数）。
 * 转换规则：
 *   text content → { type: 'text', text }
 *   reasoning content → { type: 'reasoning', text }
 *   tool-call + tool-result → { type: 'tool-{name}', state: 'output-available', ... }
 *   tool-call + tool-error → { type: 'tool-{name}', state: 'output-error', errorText }
 */
export function appendStepToParts(
    prev: UIMessagePart[],
    step: StepResult<ToolSet>,
): UIMessagePart[] {
    const next: UIMessagePart[] = [...prev, { type: 'step-start' }]

    const content = step.content as Array<{
        type: string
        text?: string
        toolCallId?: string
        toolName?: string
        input?: unknown
        output?: unknown
        error?: unknown
    }>

    // 建立 toolCallId → result/error 的快速查找
    const resultByCallId = new Map<string, { output: unknown }>()
    const errorByCallId = new Map<string, { error: unknown }>()

    for (const part of content) {
        if (part.type === 'tool-result' && part.toolCallId)
            resultByCallId.set(part.toolCallId, { output: part.output })
        if (part.type === 'tool-error' && part.toolCallId)
            errorByCallId.set(part.toolCallId, { error: part.error })
    }

    for (const part of content) {
        if (part.type === 'text' && part.text !== undefined) {
            next.push({ type: 'text', text: part.text })
        }
        else if (part.type === 'reasoning') {
            const reasoningText = (part as { text?: string }).text
            if (reasoningText !== undefined)
                next.push({ type: 'reasoning', text: reasoningText })
        }
        else if (part.type === 'tool-call' && part.toolCallId && part.toolName) {
            const result = resultByCallId.get(part.toolCallId)
            const errorEntry = errorByCallId.get(part.toolCallId)

            if (errorEntry) {
                const errorText = errorEntry.error instanceof Error
                    ? errorEntry.error.message
                    : String(errorEntry.error)
                next.splice(0, next.length, ...withoutPriorToolInvocation(next, part.toolCallId))
                next.push({
                    type: `tool-${part.toolName}`,
                    state: 'output-error',
                    toolCallId: part.toolCallId,
                    input: part.input,
                    errorText,
                })
            }
            else if (result) {
                next.splice(0, next.length, ...withoutPriorToolInvocation(next, part.toolCallId))
                next.push({
                    type: `tool-${part.toolName}`,
                    state: 'output-available',
                    toolCallId: part.toolCallId,
                    input: part.input,
                    output: result.output,
                })
            }
            else {
                // 无对应结果：需审批的工具在同一步常先落到 input-available；从同 toolCallId 的较早 part 继承 approval，避免落库丢 id 后 HTTP 批永远无法匹配
                const priorWithApproval = [...next].reverse().find((p) => {
                    const t = (p as { type?: string }).type
                    return typeof t === 'string'
                        && t.startsWith('tool-')
                        && toolCallIdOf(p as UIMessagePart) === part.toolCallId
                        && (p as { approval?: unknown }).approval != null
                }) as { approval?: unknown } | undefined
                next.push({
                    type: `tool-${part.toolName}`,
                    state: 'input-available',
                    toolCallId: part.toolCallId,
                    input: part.input,
                    ...(priorWithApproval?.approval != null ? { approval: priorWithApproval.approval } : {}),
                })
            }
        }
        // 其他 content 类型（source 等）仍忽略
    }

    return next
}

/**
 * 从 step.response.messages 中找到 tool-result，回写到 runningParts 中
 * state 为 'input-available' 或已批准的 'approval-responded' 的对应 tool part（跨步骤 / 跨请求审批场景）。
 *
 * 仅修改上述挂起 part，不覆盖已有 output-*。
 */
export function patchToolResultsFromResponseMessages(
    runningParts: UIMessagePart[],
    responseMessages: ResponseMessageLike[],
): UIMessagePart[] {
    // 收集所有 tool-result（来自 role='tool' 消息）
    const resultByCallId = new Map<string, UIMessagePart['output']>()

    for (const msg of responseMessages) {
        if (msg.role !== 'tool')
            continue
        const toolMsg = msg as ToolResultMessage
        for (const part of toolMsg.content) {
            if (part.type !== 'tool-result')
                continue
            const { toolCallId, output } = part
            if (output.type === 'json' || output.type === 'text') {
                resultByCallId.set(toolCallId, { _resolved: output.value ?? output })
            }
            else if (output.type === 'execution-denied') {
                resultByCallId.set(toolCallId, { _denied: true, reason: output.reason ?? '执行被拒绝' })
            }
            else if (output.type === 'error-text' || output.type === 'error-json') {
                resultByCallId.set(toolCallId, { _error: true, value: output.value })
            }
        }
    }

    if (resultByCallId.size === 0)
        return runningParts

    return runningParts.map((part) => {
        const p = part as Record<string, unknown>
        const st = p.state
        const patchable
            = (st === 'input-available' || st === 'approval-responded') && typeof p.toolCallId === 'string'
        if (!patchable)
            return part

        if (st === 'approval-responded') {
            const ap = p.approval as { approved?: boolean } | undefined
            if (ap?.approved !== true)
                return part
        }

        const result = resultByCallId.get(p.toolCallId as string)
        if (!result)
            return part

        const r = result as Record<string, unknown>
        if (r._denied) {
            return { ...part, state: 'output-error', errorText: r.reason as string }
        }
        if (r._error) {
            return { ...part, state: 'output-error', errorText: String(r.value) }
        }
        // json / text output: 直接用 _resolved 值作为 output
        return { ...part, state: 'output-available', output: r._resolved }
    })
}
