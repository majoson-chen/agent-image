/** SSR 重载时把 DB Message 行转换为 UIMessage 初始值 */

import { parseMessagePayload } from '@lib/db/message-payload'

interface DbMessageRow {
    id: string
    role: string
    payload: unknown
}

interface MappedMessage {
    id: string
    role: 'user' | 'assistant'
    parts: object[]
}

export function mapDbMessagesToInitialMessages(messages: DbMessageRow[]): MappedMessage[] {
    return messages.map((m) => {
        const payload = parseMessagePayload(m.payload)
        const role = payload.role as 'user' | 'assistant'
        const parts = Array.isArray(payload.parts)
            ? payload.parts as object[]
            : [{ type: 'text' as const, text: '' }]
        return { id: m.id, role, parts }
    })
}
