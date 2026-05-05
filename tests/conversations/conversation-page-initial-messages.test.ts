import { mapDbMessagesToInitialMessages } from '@lib/conversations/initial-messages'
/**
 * U1 — SSR 重载：map 如实保留 DB payload.parts
 */
import { describe, expect, it } from 'vitest'

function userRow(id: string, parts: object[]) {
    return {
        id,
        role: 'USER',
        payload: { role: 'user' as const, parts, metadata: {} },
    }
}

function assistantRow(id: string, parts: object[]) {
    return {
        id,
        role: 'ASSISTANT',
        payload: { role: 'assistant' as const, parts, metadata: {} },
    }
}

describe('mapDbMessagesToInitialMessages', () => {
    it('user message with DB parts — preserves multiple parts, not text-only', () => {
        const dbMessages = [
            userRow('msg-1', [
                { type: 'text', text: 'see this' },
                { type: 'text', text: 'continuation' },
            ]),
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages)

        expect(result[0]!.parts).toHaveLength(2)
        expect(result[0]!.parts[0]).toMatchObject({ type: 'text', text: 'see this' })
        expect(result[0]!.parts[1]).toMatchObject({ type: 'text', text: 'continuation' })
    })

    it('user message with single text part in payload', () => {
        const dbMessages = [
            userRow('msg-2', [{ type: 'text', text: 'hello' }]),
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages)

        expect(result[0]!.parts).toHaveLength(1)
        expect(result[0]!.parts[0]).toMatchObject({ type: 'text', text: 'hello' })
    })

    it('user message with empty parts array [] — passes through empty array (not fallback)', () => {
        const dbMessages = [
            userRow('msg-3', []),
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages)

        expect(result[0]!.parts).toHaveLength(0)
    })

    it('assistant message with DB parts — preserved (existing behavior)', () => {
        const dbMessages = [
            assistantRow('msg-4', [
                { type: 'step-start' },
                { type: 'text', text: 'hello' },
            ]),
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages)

        expect(result[0]!.parts).toHaveLength(2)
        expect(result[0]!.parts[0]).toMatchObject({ type: 'step-start' })
    })

    it('assistant message with single text part in payload', () => {
        const dbMessages = [
            assistantRow('msg-5', [{ type: 'text', text: 'some text' }]),
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages)

        expect(result[0]!.parts).toHaveLength(1)
        expect(result[0]!.parts[0]).toMatchObject({ type: 'text', text: 'some text' })
    })
})
