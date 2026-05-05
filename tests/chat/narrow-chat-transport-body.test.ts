import type { UIMessage } from 'ai'
/**
 * 窄 POST body：与 chatPostBodySchema、SPEC §4 对齐（Layer 05）。
 */
import { buildNarrowChatPostBody } from '@lib/chat/narrow-chat-transport-body'
import { chatPostBodySchema } from '@lib/validation/chat-post-schema'
import { describe, expect, it } from 'vitest'

describe('buildNarrowChatPostBody', () => {
    it('user-turn: last user message', () => {
        const messages = [
            { id: 'a1', role: 'assistant', parts: [] },
            { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
        ] as UIMessage[]
        const body = buildNarrowChatPostBody({
            conversationId: 'c1',
            trigger: 'submit-message',
            messageId: 'u2',
            messages,
        })
        expect(body).toEqual({
            kind: 'user-turn',
            conversationId: 'c1',
            messageId: 'u2',
            parts: [{ type: 'text', text: 'hi' }],
        })
        expect(chatPostBodySchema.safeParse(body).success).toBe(true)
    })

    it('tool-approval: approval-responded parts', () => {
        const messages = [
            {
                id: 'as1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-image-generate-primary',
                        state: 'approval-responded',
                        toolCallId: 'tc1',
                        approval: { id: 'ap1', approved: true, reason: undefined },
                        input: { prompt: 'x' },
                    },
                ],
            },
        ] as unknown as UIMessage[]
        const body = buildNarrowChatPostBody({
            conversationId: 'c1',
            trigger: 'submit-message',
            messageId: 'as1',
            messages,
        })
        expect(body.kind).toBe('tool-approval')
        if (body.kind === 'tool-approval') {
            expect(body.assistantMessageId).toBe('as1')
            expect(body.approvals).toEqual([{ approvalId: 'ap1', approved: true }])
        }
        expect(chatPostBodySchema.safeParse(body).success).toBe(true)
    })

    it('rejects regenerate', () => {
        expect(() =>
            buildNarrowChatPostBody({
                conversationId: 'c1',
                trigger: 'regenerate-message',
                messageId: 'x',
                messages: [{ id: 'u', role: 'user', parts: [] }] as UIMessage[],
            }),
        ).toThrow()
    })
})
