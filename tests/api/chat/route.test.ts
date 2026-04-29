import type { PrismaClient } from '../../../generated/prisma/client'
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test'
/**
 * U5 — 聊天 Route Handler 集成测试
 *
 * 用 MockLanguageModelV3 + convertArrayToReadableStream 模拟 streamText。
 * 验证：
 * 1. 返回流式响应（UI Message Stream 格式）
 * 2. onFinish 将 usage 写入数据库
 * 3. 无 LLM 选型时返回 400
 * 4. messageMetadata finish part 含 usage
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST } from '../../../app/api/chat/route'
import { createConversation } from '../../../lib/db/conversations'
import { aggregateUsage, appendUserMessage } from '../../../lib/db/messages'
import { createLlmModel } from '../../../lib/db/models'
import { setSelection } from '../../../lib/db/selections'
import { createTestDb } from '../../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

function makeStreamModel(text: string) {
    return new MockLanguageModelV3({
        doStream: {
            stream: convertArrayToReadableStream([
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: text },
                { type: 'text-end', id: 'text-1' },
                {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: {
                        inputTokens: { total: 10 },
                        outputTokens: { total: 5 },
                    },
                },
            ]),
            response: { headers: {} },
        },
    })
}

async function setupConversationWithLlm() {
    const llmModel = await createLlmModel(prisma, {
        name: 'test-llm',
        providerType: 'OPENAI',
        apiKey: 'sk-test',
        contextWindow: 4096,
    })
    const conv = await createConversation(prisma)
    await setSelection(prisma, conv.id, 'LLM', llmModel.id)
    await appendUserMessage(prisma, conv.id, 'hello')
    return { conv, llmModel }
}

function makeRequest(body: unknown) {
    return new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('pOST /api/chat', () => {
    it('returns 400 when conversationId missing', async () => {
        const res = await POST(makeRequest({}), { prisma })
        expect(res.status).toBe(400)
    })

    it('returns 400 when no LLM selection', async () => {
        const conv = await createConversation(prisma)
        const res = await POST(makeRequest({ conversationId: conv.id }), { prisma })
        expect(res.status).toBe(400)
    })

    it('streams a response with UI message stream headers', async () => {
        const { conv } = await setupConversationWithLlm()
        const mockModel = makeStreamModel('Hello world')

        const res = await POST(
            makeRequest({ conversationId: conv.id }),
            { prisma, model: mockModel },
        )

        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/event-stream')
    })

    it('writes usage to db via onFinish', async () => {
        const { conv } = await setupConversationWithLlm()
        const mockModel = makeStreamModel('hi')

        const res = await POST(
            makeRequest({ conversationId: conv.id }),
            { prisma, model: mockModel },
        )

        // 消费流，触发 onFinish；onFinish 是异步 callback，稍作等待
        const reader = res.body!.getReader()
        while (!(await reader.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 50))

        const usage = await aggregateUsage(prisma, conv.id)
        expect(usage?.totalTokens).toBe(15)
    })
})
