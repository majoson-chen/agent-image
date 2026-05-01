import { mapDbMessagesToInitialMessages } from '@lib/conversations/initial-messages'
/**
 * U1 — SSR 重载 user.parts 丢失的 characterization 测试
 *
 * 当前坏行为：page.tsx 中对 role=user 的消息强制返回 text-only parts，
 * 忽略 DB 中已持久化的富类型 parts 时 SSR 会变 text-only——本测试断言 map 如实保留 DB parts。
 * 修复后行为：user 与 assistant 路径共用同一段 ternary，DB parts 优先。
 */
import { describe, expect, it } from 'vitest'

describe('mapDbMessagesToInitialMessages', () => {
    it('user message with DB parts — preserves multiple parts, not text-only', () => {
        const dbMessages = [
            {
                id: 'msg-1',
                role: 'USER',
                content: 'see this',
                parts: [
                    { type: 'text', text: 'see this' },
                    { type: 'text', text: 'continuation' },
                ],
            },
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages as never)

        expect(result[0]!.parts).toHaveLength(2)
        expect(result[0]!.parts[0]).toMatchObject({ type: 'text', text: 'see this' })
        expect(result[0]!.parts[1]).toMatchObject({ type: 'text', text: 'continuation' })
    })

    it('user message with null parts — fallback to text-only', () => {
        const dbMessages = [
            {
                id: 'msg-2',
                role: 'USER',
                content: 'hello',
                parts: null,
            },
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages as never)

        expect(result[0]!.parts).toHaveLength(1)
        expect(result[0]!.parts[0]).toMatchObject({ type: 'text', text: 'hello' })
    })

    it('user message with empty parts array [] — passes through empty array (not fallback)', () => {
        const dbMessages = [
            {
                id: 'msg-3',
                role: 'USER',
                content: 'empty',
                parts: [],
            },
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages as never)

        expect(result[0]!.parts).toHaveLength(0)
    })

    it('assistant message with DB parts — preserved (existing behavior)', () => {
        const dbMessages = [
            {
                id: 'msg-4',
                role: 'ASSISTANT',
                content: '',
                parts: [
                    { type: 'step-start' },
                    { type: 'text', text: 'hello' },
                ],
            },
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages as never)

        expect(result[0]!.parts).toHaveLength(2)
        expect(result[0]!.parts[0]).toMatchObject({ type: 'step-start' })
    })

    it('assistant message with null parts — fallback to text-only', () => {
        const dbMessages = [
            {
                id: 'msg-5',
                role: 'ASSISTANT',
                content: 'some text',
                parts: null,
            },
        ]

        const result = mapDbMessagesToInitialMessages(dbMessages as never)

        expect(result[0]!.parts).toHaveLength(1)
        expect(result[0]!.parts[0]).toMatchObject({ type: 'text', text: 'some text' })
    })
})
