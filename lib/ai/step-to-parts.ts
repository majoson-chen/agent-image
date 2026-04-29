import type { StepResult, ToolSet } from 'ai'
import 'server-only'

interface UIMessagePart { type: string, [key: string]: unknown }

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
        else if (part.type === 'tool-call' && part.toolCallId && part.toolName) {
            const result = resultByCallId.get(part.toolCallId)
            const errorEntry = errorByCallId.get(part.toolCallId)

            if (errorEntry) {
                const errorText = errorEntry.error instanceof Error
                    ? errorEntry.error.message
                    : String(errorEntry.error)
                next.push({
                    type: `tool-${part.toolName}`,
                    state: 'output-error',
                    toolCallId: part.toolCallId,
                    input: part.input,
                    errorText,
                })
            }
            else if (result) {
                next.push({
                    type: `tool-${part.toolName}`,
                    state: 'output-available',
                    toolCallId: part.toolCallId,
                    input: part.input,
                    output: result.output,
                })
            }
            else {
                // 无对应结果（不应发生于 onStepFinish），降级为 input-available
                next.push({
                    type: `tool-${part.toolName}`,
                    state: 'input-available',
                    toolCallId: part.toolCallId,
                    input: part.input,
                })
            }
        }
        // 其他 content 类型（reasoning、source 等）忽略
    }

    return next
}

/**
 * 从 step.response.messages 中找到 tool-result，回写到 runningParts 中
 * state 为 'input-available' 的对应 tool part（跨步骤 / 跨请求审批场景）。
 *
 * 仅修改 state 仍为 input-available 的 part，不覆盖已有结果。
 */
export function patchToolResultsFromResponseMessages(
    runningParts: UIMessagePart[],
    responseMessages: ResponseMessageLike[],
): UIMessagePart[] {
    // 收集所有 tool-result（来自 role='tool' 消息）
    const resultByCallId = new Map<string, UIMessagePart['output']>()

    for (const msg of responseMessages) {
        if (msg.role !== 'tool') continue
        const toolMsg = msg as ToolResultMessage
        for (const part of toolMsg.content) {
            if (part.type !== 'tool-result') continue
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

    if (resultByCallId.size === 0) return runningParts

    return runningParts.map((part) => {
        const p = part as Record<string, unknown>
        if (p.state !== 'input-available' || !p.toolCallId) return part

        const result = resultByCallId.get(p.toolCallId as string)
        if (!result) return part

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
