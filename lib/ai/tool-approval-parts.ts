import 'server-only'

export interface ApprovalDecisionInput {
    approvalId: string
    approved: boolean
    reason?: string
}

/**
 * 将 tool part 上 approval.id 匹配的项从 approval-requested 推进为下一状态；
 * 拒绝 → output-denied + approval.{ id, approved:false, reason }（对齐 AI SDK UIMessage 校验；语义仍为用户未批准类理由）。
 */
export function applyToolApprovalsToParts(parts: unknown[], approvals: ApprovalDecisionInput[]): unknown[] {
    const map = new Map(approvals.map(a => [a.approvalId, a]))
    return parts.map((p) => {
        if (typeof p !== 'object' || p === null)
            return p
        const part = p as Record<string, unknown>
        const approval = part.approval as { id?: string } | undefined
        const state = part.state as string | undefined
        if (!approval?.id || state !== 'approval-requested')
            return p
        const decision = map.get(approval.id)
        if (!decision)
            return p
        if (decision.approved) {
            return { ...part, state: 'input-available' }
        }
        const rest: Record<string, unknown> = { ...part }
        delete rest.errorText
        const reason = (decision.reason != null && String(decision.reason).trim() !== '')
            ? decision.reason
            : '用户未批准'
        return {
            ...rest,
            state: 'output-denied',
            approval: {
                id: approval.id,
                approved: false as const,
                reason,
            },
        }
    })
}
