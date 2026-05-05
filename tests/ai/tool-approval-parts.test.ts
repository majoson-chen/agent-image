/**
 * tool-approval HTTP → DB parts 合并（applyToolApprovalsToParts）
 */
import { applyToolApprovalsToParts } from '@lib/ai/tool-approval-parts'
import { describe, expect, it } from 'vitest'

function part(p: Record<string, unknown>) {
    return p
}

describe('applyToolApprovalsToParts', () => {
    it('批准：approval-requested → approval-responded + approved true', () => {
        const parts = [
            part({
                type: 'tool-image-gen',
                state: 'approval-requested',
                approval: { id: 'ap1' },
                toolCallId: 'tc1',
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{ approvalId: 'ap1', approved: true }])
        expect((out[0] as { state: string }).state).toBe('approval-responded')
        expect((out[0] as { approval: { id: string, approved: boolean } }).approval).toEqual({
            id: 'ap1',
            approved: true,
        })
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

    it('批准：input-available 且无 approval.approved（遗留）→ approval-responded', () => {
        const parts = [
            part({
                type: 'tool-image-gen',
                state: 'input-available',
                approval: { id: 'ap-legacy' },
                toolCallId: 'tcL',
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{ approvalId: 'ap-legacy', approved: true }])
        expect((out[0] as { state: string }).state).toBe('approval-responded')
        expect((out[0] as { approval: { approved: boolean } }).approval.approved).toBe(true)
    })

    it('拒绝：input-available 且无 approved 标记 → output-denied', () => {
        const parts = [
            part({
                type: 'tool-image-gen',
                state: 'input-available',
                approval: { id: 'ap-ld' },
                toolCallId: 'tcD',
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{ approvalId: 'ap-ld', approved: false }])
        expect((out[0] as { state: string }).state).toBe('output-denied')
    })

    it('批准：input-available 且无 approval 对象时按 toolCallId 匹配', () => {
        const parts = [
            part({
                type: 'tool-image-gen',
                state: 'input-available',
                toolCallId: 'functions.image-generate-primary:0',
                input: { prompt: 'x' },
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{
            approvalId: 'ap-from-client',
            approved: true,
            toolCallId: 'functions.image-generate-primary:0',
        }])
        expect((out[0] as { state: string }).state).toBe('approval-responded')
        expect((out[0] as { approval: { id: string, approved: boolean } }).approval).toEqual({
            id: 'ap-from-client',
            approved: true,
        })
    })

    it('input-available 且已有 approved:true 时不改写', () => {
        const parts = [
            part({
                type: 'tool-x',
                state: 'input-available',
                approval: { id: 'ap1', approved: true },
            }),
        ]
        const out = applyToolApprovalsToParts(parts, [{ approvalId: 'ap1', approved: true }])
        expect(out[0]).toEqual(parts[0])
    })
})
