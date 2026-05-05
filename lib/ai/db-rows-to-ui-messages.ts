import type { Message } from '~/generated/prisma/client'
import { parseMessagePayload } from '@lib/db/message-payload'
import 'server-only'

/** 按 createdAt 序；跳过 SYSTEM；parts 来自 payload */
export function dbRowsToUiMessagesForHydrate(rows: Message[]): Array<{ id: string, role: 'user' | 'assistant', parts: object[] }> {
    const sorted = [...rows].sort((a, b) => {
        const t = a.createdAt.getTime() - b.createdAt.getTime()
        if (t !== 0)
            return t
        return a.id.localeCompare(b.id)
    })
    const out: Array<{ id: string, role: 'user' | 'assistant', parts: object[] }> = []
    for (const row of sorted) {
        if (row.role === 'SYSTEM')
            continue
        const payload = parseMessagePayload(row.payload)
        const role = payload.role === 'assistant' ? 'assistant' : 'user'
        const parts = Array.isArray(payload.parts) ? payload.parts as object[] : []
        out.push({ id: row.id, role, parts })
    }
    return out
}
