/**
 * 从 useChat 内存 messages 构造与 chatPostBodySchema 一致的窄 POST body。
 * 依据 AI SDK：审批后 part 为 state === 'approval-responded'，approval: { id, approved, reason }。
 */
import type { UIMessage } from 'ai'

export interface NarrowBodyOptions {
    conversationId: string
    trigger: 'submit-message' | 'regenerate-message'
    messageId: string | undefined
    messages: UIMessage[]
}

export type NarrowChatPostBody
    = | {
        kind: 'user-turn'
        conversationId: string
        messageId: string
        parts: unknown[]
    }
    | {
        kind: 'tool-approval'
        conversationId: string
        assistantMessageId: string
        approvals: Array<{ approvalId: string, approved: boolean, reason?: string, toolCallId?: string }>
    }

export function collectApprovalsFromAssistantMessage(msg: UIMessage): Array<{ approvalId: string, approved: boolean, reason?: string, toolCallId?: string }> {
    const out: Array<{ approvalId: string, approved: boolean, reason?: string, toolCallId?: string }> = []
    for (const p of msg.parts) {
        if (typeof p !== 'object' || p === null)
            continue
        const part = p as Record<string, unknown>
        if (part.state !== 'approval-responded')
            continue
        const ap = part.approval as { id?: string, approved?: boolean, reason?: string } | undefined
        if (ap?.id == null || typeof ap.approved !== 'boolean')
            continue
        const toolCallId = typeof part.toolCallId === 'string' ? part.toolCallId : undefined
        out.push({
            approvalId: ap.id,
            approved: ap.approved,
            ...(ap.reason != null ? { reason: ap.reason } : {}),
            ...(toolCallId != null ? { toolCallId } : {}),
        })
    }
    return out
}

export function buildNarrowChatPostBody(o: NarrowBodyOptions): NarrowChatPostBody {
    if (o.trigger === 'regenerate-message')
        throw new Error('regenerate-message 未在窄 body 规格中实现')

    const last = o.messages.at(-1)
    if (!last)
        throw new Error('无消息可发送')

    const assistantApprovalRound
        = o.trigger === 'submit-message'
            && o.messageId != null
            && last.role === 'assistant'
            && last.id === o.messageId

    if (assistantApprovalRound) {
        const approvals = collectApprovalsFromAssistantMessage(last)
        if (approvals.length === 0)
            throw new Error('未找到 approval-responded 的 tool part')
        return {
            kind: 'tool-approval',
            conversationId: o.conversationId,
            assistantMessageId: o.messageId,
            approvals,
        }
    }

    if (last.role !== 'user')
        throw new Error('当前仅支持 user 发送或 assistant 审批后的自动提交')

    return {
        kind: 'user-turn',
        conversationId: o.conversationId,
        messageId: last.id,
        parts: last.parts as unknown[],
    }
}
