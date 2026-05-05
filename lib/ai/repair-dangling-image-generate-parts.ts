/**
 * 将未完成的主/次生图工具 part 规范为 output-denied，避免 convertToModelMessages →
 * convertToLanguageModelPrompt 因「tool-call 无 tool-result」抛出 MissingToolResultsError。
 *
 * 典型场景：用户在新一轮 user 消息里继续提问，而上一轮 assistant 仍停留在 approval-requested /
 * input-available / executing（未落盘为 output-*），历史从 DB 重载后也会复现。
 */
import 'server-only'

const INCOMPLETE_STATES = new Set([
    'approval-requested',
    'input-streaming',
    'input-available',
    'executing',
])

function isImageGenerateToolPart(p: object): boolean {
    const x = p as Record<string, unknown>
    if (x.type === 'tool-image-generate-primary' || x.type === 'tool-image-generate-secondary')
        return true
    return x.type === 'dynamic-tool'
        && (x.toolName === 'image-generate-primary' || x.toolName === 'image-generate-secondary')
}

export type UiLike = { id: string, role: 'user' | 'assistant', parts: object[] }

function sliceHasLaterUser(messages: UiLike[], assistantIndex: number): boolean {
    return messages.slice(assistantIndex + 1).some(msg => msg.role === 'user')
}

export function repairDanglingImageGenerateToolParts(messages: UiLike[]): UiLike[] {
    return messages.map((m, assistantIndex) => {
        if (m.role !== 'assistant')
            return m
        const hasLaterUser = sliceHasLaterUser(messages, assistantIndex)
        const parts = m.parts.flatMap((part) => {
            if (!isImageGenerateToolPart(part))
                return [part]
            const p = part as Record<string, unknown>
            const state = p.state as string | undefined
            if (!state || !INCOMPLETE_STATES.has(state))
                return [part]

            // 仅当该 assistant 之后还存在 user 消息时，才将「未完成」生图 part 收尾为 output-denied。
            // 否则会把 tool-approval 合并后的挂起态（如 approval-responded / input-available）误判为悬空并错误收尾。
            if (!hasLaterUser)
                return [part]

            const approval = p.approval as { id?: string } | undefined
            const toolCallId = typeof p.toolCallId === 'string' ? p.toolCallId : undefined
            const approvalId = typeof approval?.id === 'string'
                ? approval.id
                : toolCallId != null
                    ? `orphan:${toolCallId}`
                    : null
            if (approvalId == null)
                return [] // 无法构造合法 output-denied，丢弃悬空 part

            return [{
                ...p,
                state: 'output-denied',
                approval: {
                    id: approvalId,
                    approved: false as const,
                    reason: '该生图调用未在会话内完成（未完成确认或中断），续写已跳过。',
                },
                errorText: undefined,
            }]
        })
        return { ...m, parts }
    })
}
