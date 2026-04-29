/**
 * U5 — 聊天 Route Handler 集成测试（M2 扩展）
 *
 * 用 MockLanguageModelV3 + convertArrayToReadableStream 模拟工具循环。
 * 验证：
 * 1. 基础流式响应 + onStepFinish 落库
 * 2. 工具调用 → 成功 → parts 写入 DB
 * 3. 工具调用 → 失败 → output-error parts 写入 DB
 * 4. 无 LLM 选型时返回 400
 */
import type { LanguageModel } from 'ai'
import type { PrismaClient } from '../../../generated/prisma/client'
import { tool } from 'ai'
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { handleChatPost } from '../../../app/api/chat/route'
import { createConversation } from '../../../lib/db/conversations'
import { aggregateUsage, appendUserMessage, listMessages } from '../../../lib/db/messages'
import { createLlmModel } from '../../../lib/db/models'
import { setSelection } from '../../../lib/db/selections'
import { createTestDb } from '../../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

function makeStreamModel(text: string): LanguageModel {
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
    } as never) as unknown as LanguageModel
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
    it('persists user messages from POST body when messages provided', async () => {
        const llmModel = await createLlmModel(prisma, {
            name: 'test-llm-body',
            providerType: 'OPENAI',
            apiKey: 'sk-test',
            contextWindow: 4096,
        })
        const conv = await createConversation(prisma)
        await setSelection(prisma, conv.id, 'LLM', llmModel.id)

        const userMsgId = 'client-user-msg-body-1'
        const mockModel = makeStreamModel('ack')

        const res = await handleChatPost(
            makeRequest({
                conversationId: conv.id,
                messages: [
                    { id: userMsgId, role: 'user', parts: [{ type: 'text', text: 'only-from-body' }] },
                ],
            }),
            { prisma, model: mockModel },
        )

        expect(res.status).toBe(200)
        const reader = res.body!.getReader()
        while (!(await reader.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 50))

        const msgs = await listMessages(prisma, conv.id)
        const row = msgs.find(m => m.id === userMsgId)
        expect(row).toBeDefined()
        expect(row?.role).toBe('USER')
        expect(row?.content).toContain('only-from-body')
    })

    it('returns 400 when conversationId missing', async () => {
        const res = await handleChatPost(makeRequest({}), { prisma })
        expect(res.status).toBe(400)
    })

    it('returns 400 when no LLM selection', async () => {
        const conv = await createConversation(prisma)
        const res = await handleChatPost(makeRequest({ conversationId: conv.id }), { prisma })
        expect(res.status).toBe(400)
    })

    it('streams a response with UI message stream headers', async () => {
        const { conv } = await setupConversationWithLlm()
        const mockModel = makeStreamModel('Hello world')

        const res = await handleChatPost(
            makeRequest({ conversationId: conv.id }),
            { prisma, model: mockModel },
        )

        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/event-stream')
    })

    it('writes usage to db via onStepFinish', async () => {
        const { conv } = await setupConversationWithLlm()
        const mockModel = makeStreamModel('hi')

        const res = await handleChatPost(
            makeRequest({ conversationId: conv.id }),
            { prisma, model: mockModel },
        )

        // 消费流，触发 onStepFinish
        const reader = res.body!.getReader()
        while (!(await reader.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 50))

        const usage = await aggregateUsage(prisma, conv.id)
        expect(usage?.totalTokens).toBeGreaterThan(0)
    })

    it('tool success → onStepFinish writes output-available part to DB', async () => {
        const { conv } = await setupConversationWithLlm()

        // 第 1 次 LLM 调用：产生工具调用
        // 第 2 次 LLM 调用：工具结果已喂回，生成文本总结
        let callCount = 0
        const mockModel = new MockLanguageModelV3({
            doStream: async () => {
                callCount++
                if (callCount === 1) {
                    return {
                        stream: convertArrayToReadableStream([
                            { type: 'tool-input-start', id: 'tc-1', toolName: 'echo-tool' },
                            { type: 'tool-input-delta', id: 'tc-1', delta: '{"text":"hello"}' },
                            { type: 'tool-input-end', id: 'tc-1' },
                            { type: 'tool-call', toolCallId: 'tc-1', toolName: 'echo-tool', input: '{"text":"hello"}' },
                            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: { total: 5 }, outputTokens: { total: 3 } } },
                        ]),
                        response: { headers: {} },
                    }
                }
                return {
                    stream: convertArrayToReadableStream([
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'Done!' },
                        { type: 'text-end', id: 'text-1' },
                        { type: 'finish', finishReason: 'stop', usage: { inputTokens: { total: 10 }, outputTokens: { total: 5 } } },
                    ]),
                    response: { headers: {} },
                }
            },
        } as never) as unknown as LanguageModel

        const echoTool = tool({
            description: '回显工具',
            inputSchema: z.object({ text: z.string() }),
            execute: async ({ text }) => ({ echoed: text }),
        })

        const res = await handleChatPost(
            makeRequest({ conversationId: conv.id }),
            { prisma, model: mockModel, toolsOverride: { 'echo-tool': echoTool } },
        )

        const reader = res.body!.getReader()
        while (!(await reader.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 100))

        const msgs = await listMessages(prisma, conv.id)
        const assistant = msgs.find(m => m.role === 'ASSISTANT')
        expect(assistant).toBeDefined()
        const parts = assistant!.parts as Array<{ type: string, state?: string }>
        const toolPart = parts.find(p => p.type === 'tool-echo-tool')
        expect(toolPart).toBeDefined()
        expect(toolPart?.state).toBe('output-available')
    })

    it('tool error → onStepFinish writes output-error part to DB', async () => {
        const { conv } = await setupConversationWithLlm()

        let callCount = 0
        const mockModel = new MockLanguageModelV3({
            doStream: async () => {
                callCount++
                if (callCount === 1) {
                    return {
                        stream: convertArrayToReadableStream([
                            { type: 'tool-input-start', id: 'tc-err', toolName: 'fail-tool' },
                            { type: 'tool-input-delta', id: 'tc-err', delta: '{}' },
                            { type: 'tool-input-end', id: 'tc-err' },
                            { type: 'tool-call', toolCallId: 'tc-err', toolName: 'fail-tool', input: '{}' },
                            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: { total: 3 }, outputTokens: { total: 2 } } },
                        ]),
                        response: { headers: {} },
                    }
                }
                return {
                    stream: convertArrayToReadableStream([
                        { type: 'text-start', id: 'text-e' },
                        { type: 'text-delta', id: 'text-e', delta: 'Tool failed, sorry.' },
                        { type: 'text-end', id: 'text-e' },
                        { type: 'finish', finishReason: 'stop', usage: { inputTokens: { total: 8 }, outputTokens: { total: 4 } } },
                    ]),
                    response: { headers: {} },
                }
            },
        } as never) as unknown as LanguageModel

        const failTool = tool({
            description: '会失败的工具',
            inputSchema: z.object({ _reason: z.string().optional() }),
            execute: async () => { throw new Error('tool execution failed') },
        })

        const res = await handleChatPost(
            makeRequest({ conversationId: conv.id }),
            { prisma, model: mockModel, toolsOverride: { 'fail-tool': failTool } },
        )

        const reader = res.body!.getReader()
        while (!(await reader.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 100))

        const msgs = await listMessages(prisma, conv.id)
        const assistant = msgs.find(m => m.role === 'ASSISTANT')
        expect(assistant).toBeDefined()
        const parts = assistant!.parts as Array<{ type: string, state?: string, errorText?: string }>
        const toolPart = parts.find(p => p.type === 'tool-fail-tool')
        expect(toolPart?.state).toBe('output-error')
        expect(toolPart?.errorText).toContain('failed')
    })
})
