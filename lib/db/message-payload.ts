/**
 * Message.payload 形状 — 与 Layer 01 迁移与 SPEC §10.3 一致。
 */
import type { MessageRole } from '~/generated/prisma/enums'

export type MessagePayloadRole = 'user' | 'assistant' | 'system'

export interface MessagePayloadMetadata {
    usage?: {
        inputTokens: number | null
        outputTokens: number | null
        totalTokens: number | null
    }
    modelIdAtTime?: string | null
}

export interface MessagePayload {
    role: MessagePayloadRole
    parts: unknown[]
    metadata?: MessagePayloadMetadata
}

export function toMessageRoleEnum(role: MessagePayloadRole): MessageRole {
    if (role === 'user')
        return 'USER'
    if (role === 'assistant')
        return 'ASSISTANT'
    return 'SYSTEM'
}

export function payloadRoleFromEnum(role: MessageRole): MessagePayloadRole {
    if (role === 'USER')
        return 'user'
    if (role === 'ASSISTANT')
        return 'assistant'
    return 'system'
}

export function parseMessagePayload(raw: unknown): MessagePayload {
    if (typeof raw !== 'object' || raw === null || !('role' in raw) || !('parts' in raw))
        throw new Error('无效 Message payload')
    const o = raw as Record<string, unknown>
    const role = o.role as MessagePayloadRole
    const parts = o.parts as unknown[]
    const metadata = o.metadata as MessagePayloadMetadata | undefined
    return { role, parts, metadata }
}
