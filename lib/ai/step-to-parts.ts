import type { StepResult, ToolSet } from 'ai'
import 'server-only'

interface UIMessagePart { type: string, [key: string]: unknown }

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
