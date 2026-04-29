import type { PrismaClient } from '../../generated/prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createConversation } from '../../lib/db/conversations'
import {
    aggregateUsage,
    appendAssistantMessage,
    appendUserMessage,
    listMessages,
} from '../../lib/db/messages'
import { createLlmModel } from '../../lib/db/models'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

describe('aggregateUsage', () => {
    it('returns null for empty conversation', async () => {
        const conv = await createConversation(prisma)
        expect(await aggregateUsage(prisma, conv.id)).toBeNull()
    })

    it('sums totalTokens across messages with usage', async () => {
        const model = await createLlmModel(prisma, {
            name: 'agg-model',
            providerType: 'OPENAI',
            apiKey: 'sk-a',
            contextWindow: 4000,
        })
        const conv = await createConversation(prisma)
        await appendUserMessage(prisma, conv.id, 'hello')
        await appendAssistantMessage(prisma, conv.id, 'hi', { inputTokens: 10, outputTokens: 20, totalTokens: 30 }, model.id)
        await appendAssistantMessage(prisma, conv.id, 'bye', { inputTokens: 5, outputTokens: 15, totalTokens: 20 }, model.id)

        const usage = await aggregateUsage(prisma, conv.id)
        expect(usage?.totalTokens).toBe(50)
        expect(usage?.inputTokens).toBe(15)
        expect(usage?.outputTokens).toBe(35)
    })

    it('ignores messages without usage', async () => {
        const conv = await createConversation(prisma)
        await appendUserMessage(prisma, conv.id, 'no usage')
        // assistant without usage
        await prisma.message.create({
            data: { conversationId: conv.id, role: 'ASSISTANT', content: 'ok' },
        })
        expect(await aggregateUsage(prisma, conv.id)).toBeNull()
    })

    it('does not mix usage across conversations', async () => {
        const model = await createLlmModel(prisma, {
            name: 'iso-model',
            providerType: 'OPENAI',
            apiKey: 'sk-b',
            contextWindow: 4000,
        })
        const conv1 = await createConversation(prisma)
        const conv2 = await createConversation(prisma)
        await appendAssistantMessage(prisma, conv1.id, 'a', { inputTokens: 1, outputTokens: 2, totalTokens: 3 }, model.id)
        await appendAssistantMessage(prisma, conv2.id, 'b', { inputTokens: 100, outputTokens: 200, totalTokens: 300 }, model.id)

        const u1 = await aggregateUsage(prisma, conv1.id)
        expect(u1?.totalTokens).toBe(3)
    })
})

describe('listMessages', () => {
    it('returns messages in createdAt order', async () => {
        const conv = await createConversation(prisma)
        await appendUserMessage(prisma, conv.id, 'first')
        await appendUserMessage(prisma, conv.id, 'second')
        const msgs = await listMessages(prisma, conv.id)
        expect(msgs[0]!.content).toBe('first')
        expect(msgs[1]!.content).toBe('second')
    })
})
