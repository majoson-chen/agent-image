/**
 * tool-approval HTTP → DB parts 合并（applyToolApprovalsToParts）
 */
import { applyToolApprovalsToParts } from '@lib/ai/tool-approval-parts'
import { describe, expect, it } from 'vitest'

function part(p: Record<string, unknown>) {
    return p
}

describe('applyToolApprovalsToParts', () => {
    it('批准：approval-requested → input-available', () => {
        const parts = [
            part({
                type: 'tool-image-gen',
                state: 'approval-requested',
                approval: { id: 'ap1' },
                toolCallId: 'tc1',
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{ approvalId: 'ap1', approved: true }])
        expect((out[0] as { state: string }).state).toBe('input-available')
    })

    it('拒绝：→ output-denied 与默认 reason', () => {
        const parts = [
            part({
                type: 'tool-image-gen',
                state: 'approval-requested',
                approval: { id: 'ap2' },
                toolCallId: 'tc2',
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{ approvalId: 'ap2', approved: false }])
        expect((out[0] as { state: string }).state).toBe('output-denied')
        expect((out[0] as { approval: { id: string, approved: boolean, reason: string } }).approval).toEqual({
            id: 'ap2',
            approved: false,
            reason: '用户未批准',
        })
    })

    it('拒绝：使用 reason', () => {
        const parts = [
            part({
                type: 'tool-x',
                state: 'approval-requested',
                approval: { id: 'ap3' },
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{ approvalId: 'ap3', approved: false, reason: '用户怀疑' }])
        expect((out[0] as { approval: { reason: string } }).approval.reason).toBe('用户怀疑')
    })

    it('未匹配的 approvalId 不改 part', () => {
        const parts = [
            part({
                type: 'tool-x',
                state: 'approval-requested',
                approval: { id: 'ap-a' },
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{ approvalId: 'other', approved: true }])
        expect(out[0]).toEqual(parts[0])
    })

    it('非 approval-requested 跳过', () => {
        const parts = [
            part({
                type: 'tool-x',
                state: 'input-available',
                approval: { id: 'ap1' },
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{ approvalId: 'ap1', approved: true }])
        expect(out[0]).toEqual(parts[0])
    })
})
