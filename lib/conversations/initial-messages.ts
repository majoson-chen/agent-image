/** SSR 重载时把 DB Message 行转换为 UIMessage 初始值 */

interface DbMessage {
    id: string
    role: string
    content: string
    parts: unknown[] | null
}

interface MappedMessage {
    id: string
    role: 'user' | 'assistant'
    parts: object[]
}

/**
 * 把 DB Message 行转为 ChatPage initialMessages。
 * user 与 assistant 共用同一段 ternary：DB parts 不为 null 时优先使用，
 * 否则 fallback 到 [{ type:'text', text: m.content }]。
 */
export function mapDbMessagesToInitialMessages(messages: DbMessage[]): MappedMessage[] {
    return messages.map((m) => {
        const role = m.role.toLowerCase() as 'user' | 'assistant'
        const parts = m.parts !== null
            ? m.parts as object[]
            : [{ type: 'text' as const, text: m.content }]
        return { id: m.id, role, parts }
    })
}
