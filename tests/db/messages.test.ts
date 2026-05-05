/**
 * U2 — messages DB 层测试（扩展 M1）
 * 验证 upsertAssistantMessage 的 INSERT / UPDATE / parts 序列化往返行为
 */
import type { PrismaClient } from '~/generated/prisma/client'
import { createConversation } from '@lib/db/conversations'
import {
    appendUserMessage,
    InvalidAssistantMessageIdError,
    InvalidUserMessageIdError,
    listMessages,
    MessageConversationMismatchError,
    upsertAssistantMessage,
    upsertUserMessageParts,
} from '@lib/db/messages'
import { createLlmModel } from '@lib/db/models'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

async function makeConv() {
    const model = await createLlmModel(prisma, {
        name: 'test-llm',
        providerType: 'OPENAI',
        apiKey: 'sk-test',
        contextWindow: 4096,
    })
    const conv = await createConversation(prisma)
    return { conv, modelId: model.id }
}

function textFromPayloadParts(row: { payload: unknown }): string {
    const p = row.payload as { parts: Array<{ type: string, text?: string }> }
    return p.parts.filter(x => x.type === 'text').map(x => x.text ?? '').join('')
}

describe('upsertAssistantMessage', () => {
    it('first call INSERTs a row', async () => {
        const { conv, modelId } = await makeConv()
        const parts = [{ type: 'text', text: 'Hello' }]
        await upsertAssistantMessage(prisma, {
            id: 'run-insert-1',
            conversationId: conv.id,
            parts,
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            modelIdAtTime: modelId,
        })
        const msgs = await listMessages(prisma, conv.id)
        expect(msgs).toHaveLength(1)
        expect(msgs[0].id).toBe('run-insert-1')
        const payload = msgs[0].payload as { parts: unknown[] }
        expect(payload.parts).toEqual(parts)
    })

    it('second call with same id UPDATEs the row', async () => {
        const { conv, modelId } = await makeConv()
        const parts1 = [{ type: 'text', text: 'Step 1' }]
        const parts2 = [
            { type: 'text', text: 'Step 1' },
            { type: 'tool-web-search', state: 'output-available', toolCallId: 'tc1', input: {}, output: {} },
            { type: 'text', text: 'Done' },
        ]
        const usage1 = { inputTokens: 5, outputTokens: 3, totalTokens: 8 }
        const usage2 = { inputTokens: 15, outputTokens: 9, totalTokens: 24 }

        await upsertAssistantMessage(prisma, {
            id: 'run-update-1',
            conversationId: conv.id,
            parts: parts1,
            usage: usage1,
            modelIdAtTime: modelId,
        })
        await upsertAssistantMessage(prisma, {
            id: 'run-update-1',
            conversationId: conv.id,
            parts: parts2,
            usage: usage2,
            modelIdAtTime: modelId,
        })

        const msgs = await listMessages(prisma, conv.id)
        expect(msgs).toHaveLength(1)
        const row = msgs[0]
        const payload = row.payload as { parts: unknown[] }
        expect(payload.parts).toEqual(parts2)
        const p = row.payload as { metadata?: { usage?: { totalTokens?: number | null } } }
        expect(p.metadata?.usage?.totalTokens).toBe(24)
    })

    it('derives content from text parts', async () => {
        const { conv, modelId } = await makeConv()
        const parts = [
            { type: 'text', text: 'First' },
            { type: 'tool-web-search', state: 'output-available', toolCallId: 'tc2', input: {}, output: {} },
            { type: 'text', text: ' Second' },
        ]
        await upsertAssistantMessage(prisma, {
            id: 'run-content-1',
            conversationId: conv.id,
            parts,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            modelIdAtTime: modelId,
        })
        const msgs = await listMessages(prisma, conv.id)
        expect(textFromPayloadParts(msgs[0])).toBe('First Second')
    })

    it('empty parts → content is empty string', async () => {
        const { conv, modelId } = await makeConv()
        await upsertAssistantMessage(prisma, {
            id: 'run-empty-1',
            conversationId: conv.id,
            parts: [],
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            modelIdAtTime: modelId,
        })
        const msgs = await listMessages(prisma, conv.id)
        expect(textFromPayloadParts(msgs[0])).toBe('')
    })

    it('parts with JSON special chars round-trip correctly', async () => {
        const { conv, modelId } = await makeConv()
        const parts = [{ type: 'text', text: '{"key":"value with }braces{"}' }]
        await upsertAssistantMessage(prisma, {
            id: 'run-json-1',
            conversationId: conv.id,
            parts,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            modelIdAtTime: modelId,
        })
        const msgs = await listMessages(prisma, conv.id)
        const payload = msgs[0].payload as { parts: unknown[] }
        expect(payload.parts).toEqual(parts)
    })
})

describe('upsertUserMessageParts', () => {
    it('同一会话内第二次写入更新 payload', async () => {
        const conv = await createConversation(prisma)
        const id = 'user-upsert-same-conv'
        await upsertUserMessageParts(prisma, conv.id, {
            id,
            parts: [{ type: 'text', text: 'a' }],
        })
        await upsertUserMessageParts(prisma, conv.id, {
            id,
            parts: [{ type: 'text', text: 'b' }],
        })
        const msgs = await listMessages(prisma, conv.id)
        expect(msgs).toHaveLength(1)
        expect(textFromPayloadParts(msgs[0])).toBe('b')
    })

    it('message id 已属于其他会话时抛 MessageConversationMismatchError', async () => {
        const conv1 = await createConversation(prisma)
        const conv2 = await createConversation(prisma)
        const id = 'user-id-cross-conv'
        await upsertUserMessageParts(prisma, conv1.id, {
            id,
            parts: [{ type: 'text', text: 'on-1' }],
        })
        await expect(
            upsertUserMessageParts(prisma, conv2.id, {
                id,
                parts: [{ type: 'text', text: 'on-2' }],
            }),
        ).rejects.toThrow(MessageConversationMismatchError)
    })

    it('已有 ASSISTANT 行时 user upsert 同 id 抛 InvalidUserMessageIdError', async () => {
        const { conv, modelId } = await makeConv()
        const id = 'user-collide-assistant'
        await upsertAssistantMessage(prisma, {
            id,
            conversationId: conv.id,
            parts: [{ type: 'text', text: 'a' }],
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            modelIdAtTime: modelId,
        })
        await expect(
            upsertUserMessageParts(prisma, conv.id, { id, parts: [{ type: 'text', text: 'u' }] }),
        ).rejects.toThrow(InvalidUserMessageIdError)
    })
})

describe('upsertAssistantMessage guards', () => {
    it('conversationId 与已存在行不一致抛 MessageConversationMismatchError', async () => {
        const model = await createLlmModel(prisma, {
            name: 'test-llm-asst-guard',
            providerType: 'OPENAI',
            apiKey: 'sk-test',
            contextWindow: 4096,
        })
        const conv1 = await createConversation(prisma)
        const conv2 = await createConversation(prisma)
        const id = 'asst-cross'
        await upsertAssistantMessage(prisma, {
            id,
            conversationId: conv1.id,
            parts: [{ type: 'text', text: 'a' }],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            modelIdAtTime: model.id,
        })
        await expect(
            upsertAssistantMessage(prisma, {
                id,
                conversationId: conv2.id,
                parts: [{ type: 'text', text: 'b' }],
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                modelIdAtTime: model.id,
            }),
        ).rejects.toThrow(MessageConversationMismatchError)
    })

    it('已有 USER 行时 assistant upsert 同 id 抛 InvalidAssistantMessageIdError', async () => {
        const conv = await createConversation(prisma)
        const id = 'assistant-collide-user'
        await upsertUserMessageParts(prisma, conv.id, {
            id,
            parts: [{ type: 'text', text: 'u' }],
        })
        await expect(
            upsertAssistantMessage(prisma, {
                id,
                conversationId: conv.id,
                parts: [{ type: 'text', text: 'a' }],
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                modelIdAtTime: null,
            }),
        ).rejects.toThrow(InvalidAssistantMessageIdError)
    })
})

describe('message payload parts', () => {
    it('listMessages 返回 assistant 的 payload.parts', async () => {
        const conv = await createConversation(prisma)
        await appendUserMessage(prisma, conv.id, 'hi')
        await prisma.message.create({
            data: {
                conversationId: conv.id,
                role: 'ASSISTANT',
                payload: {
                    role: 'assistant',
                    parts: [{ type: 'text', text: 'response' }],
                    metadata: {},
                },
            },
        })
        const msgs = await listMessages(prisma, conv.id)
        const assistant = msgs.find(m => m.role === 'ASSISTANT')
        const p = assistant?.payload as { parts: unknown[] } | undefined
        expect(p?.parts).toEqual([{ type: 'text', text: 'response' }])
    })
})
