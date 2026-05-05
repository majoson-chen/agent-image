import 'server-only'

export interface ApprovalDecisionInput {
    approvalId: string
    approved: boolean
    reason?: string
    /** 与客户端 tool part 对齐；DB 中 input-available 可能缺 approval.id 时靠此项匹配 */
    toolCallId?: string
}

function findApprovalDecisionForPart(
    part: Record<string, unknown>,
    approvals: ApprovalDecisionInput[],
): ApprovalDecisionInput | undefined {
    const approval = part.approval as { id?: string } | undefined
    const toolCallId = typeof part.toolCallId === 'string' ? part.toolCallId : undefined
    if (approval?.id) {
        const hit = approvals.find(a => a.approvalId === approval.id)
        if (hit)
            return hit
    }
    if (toolCallId) {
        const hit = approvals.find(a => a.toolCallId === toolCallId)
        if (hit)
            return hit
    }
    return undefined
}

/**
 * 将 tool part 上 approval.id（或 toolCallId）匹配的项从 approval-requested / 遗留 input-available 推进为下一状态；
 * 拒绝 → output-denied + approval.{ id, approved:false, reason }（对齐 AI SDK UIMessage 校验；语义仍为用户未批准类理由）。
 */
export function applyToolApprovalsToParts(parts: unknown[], approvals: ApprovalDecisionInput[]): unknown[] {
    return parts.map((p) => {
        if (typeof p !== 'object' || p === null)
            return p
        const part = p as Record<string, unknown>
        const state = part.state as string | undefined
        if (state === undefined)
            return p

        const decision = findApprovalDecisionForPart(part, approvals)
        if (!decision)
            return p

        const approval = part.approval as { id?: string, approved?: boolean } | undefined
        const approvalFlag = approval?.approved

        /** 待人确认 Card，或 SDK/落盘遗留的「input-available 但无 approved:true」（常伴有 appendStep 丢 approval.id） */
        const awaitingCard = state === 'approval-requested'
        const legacyIncompleteInputAvailable = state === 'input-available' && approvalFlag !== true

        if (!awaitingCard && !legacyIncompleteInputAvailable)
            return p

        if (decision.approved) {
            return {
                ...part,
                state: 'approval-responded',
                approval: {
                    id: decision.approvalId,
                    approved: true as const,
                },
            }
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
                id: decision.approvalId,
                approved: false as const,
                reason,
            },
        }
    })
}
