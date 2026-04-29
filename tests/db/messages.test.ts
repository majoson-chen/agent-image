/**
 * U2 — messages DB 层测试（扩展 M1）
 * 验证 upsertAssistantMessage 的 INSERT / UPDATE / parts 序列化往返行为
 */
import type { PrismaClient } from '../../generated/prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createConversation } from '../../lib/db/conversations'
import { appendUserMessage, listMessages, upsertAssistantMessage } from '../../lib/db/messages'
import { createLlmModel } from '../../lib/db/models'
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
        expect(msgs[0].parts).toEqual(parts)
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
        expect(msgs[0].parts).toEqual(parts2)
        expect(msgs[0].usageTotalTokens).toBe(24)
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
        expect(msgs[0].content).toBe('First Second')
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
        expect(msgs[0].content).toBe('')
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
        expect(msgs[0].parts).toEqual(parts)
    })
})

describe('listMessages parts field', () => {
    it('m1 legacy message (no parts) returns parts=null', async () => {
        const conv = await createConversation(prisma)
        await appendUserMessage(prisma, conv.id, 'hi')
        // 直接 create 模拟旧 M1 消息（不设 parts）
        await prisma.message.create({
            data: { conversationId: conv.id, role: 'ASSISTANT', content: 'response' },
        })
        const msgs = await listMessages(prisma, conv.id)
        const assistant = msgs.find(m => m.role === 'ASSISTANT')
        expect(assistant?.parts).toBeNull()
    })
})
