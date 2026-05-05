import { chatPostBodySchema } from '@lib/validation/chat-post-schema'
import { describe, expect, it } from 'vitest'

describe('chatPostBodySchema', () => {
    it('parses user-turn with messageId and parts', () => {
        const raw = {
            kind: 'user-turn',
            conversationId: 'c1',
            messageId: 'u1',
            parts: [{ type: 'text', text: 'hi' }],
        }
        const r = chatPostBodySchema.safeParse(raw)
        expect(r.success).toBe(true)
        if (r.success)
            expect(r.data.kind).toBe('user-turn')
    })

    it('rejects user-turn without messageId', () => {
        const r = chatPostBodySchema.safeParse({
            kind: 'user-turn',
            conversationId: 'c1',
            parts: [],
        })
        expect(r.success).toBe(false)
    })

    it('parses tool-approval with multiple approvals', () => {
        const raw = {
            kind: 'tool-approval',
            conversationId: 'c1',
            assistantMessageId: 'a1',
            approvals: [
                { approvalId: 'ap1', approved: true },
                { approvalId: 'ap2', approved: false, reason: 'no' },
            ],
        }
        const r = chatPostBodySchema.safeParse(raw)
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.data.kind).toBe('tool-approval')
            expect(r.data.approvals).toHaveLength(2)
        }
    })

    it('parses tool-approval with optional toolCallId on approvals', () => {
        const raw = {
            kind: 'tool-approval',
            conversationId: 'c1',
            assistantMessageId: 'a1',
            approvals: [{ approvalId: 'ap1', approved: true, toolCallId: 'functions.image-generate-primary:0' }],
        }
        const r = chatPostBodySchema.safeParse(raw)
        expect(r.success).toBe(true)
        if (r.success && r.data.kind === 'tool-approval')
            expect(r.data.approvals[0]?.toolCallId).toBe('functions.image-generate-primary:0')
    })

    it('rejects tool-approval with empty approvals', () => {
        const r = chatPostBodySchema.safeParse({
            kind: 'tool-approval',
            conversationId: 'c1',
            assistantMessageId: 'a1',
            approvals: [],
        })
        expect(r.success).toBe(false)
    })

    it('rejects legacy body with only messages array', () => {
        const r = chatPostBodySchema.safeParse({
            conversationId: 'c1',
            messages: [{ id: '1', role: 'user', parts: [] }],
        })
        expect(r.success).toBe(false)
    })
})
