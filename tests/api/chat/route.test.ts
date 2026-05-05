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
import type { PrismaClient } from '~/generated/prisma/client'
import { createConversation } from '@lib/db/conversations'
import { aggregateUsage, listMessages, upsertUserMessageParts } from '@lib/db/messages'
import { createLlmModel } from '@lib/db/models'
import { setSelection } from '@lib/db/selections'
import { tool } from 'ai'
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { handleChatPost } from '@/api/chat/route'
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

function textFromMessagePayload(msg: { payload: unknown }): string {
    const p = msg.payload as { parts?: Array<{ type: string, text?: string }> }
    if (!p.parts)
        return ''
    return p.parts.filter(x => x.type === 'text').map(x => x.text ?? '').join('')
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
    const userMessageId = crypto.randomUUID()
    await upsertUserMessageParts(prisma, conv.id, {
        id: userMessageId,
        parts: [{ type: 'text', text: 'hello' }],
    })
    return { conv, llmModel, userMessageId }
}

function makeRequest(body: unknown) {
    return new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('pOST /api/chat', () => {
    it('new user turn after assistant uses fresh assistant row; DB order is chronological', async () => {
        const llmModel = await createLlmModel(prisma, {
            name: 'test-llm-two-turn',
            providerType: 'OPENAI',
            apiKey: 'sk-test',
            contextWindow: 4096,
        })
        const conv = await createConversation(prisma)
        await setSelection(prisma, conv.id, 'LLM', llmModel.id)

        const user1Id = 'client-u-two-turn-1'
        const res1 = await handleChatPost(
            makeRequest({
                kind: 'user-turn',
                conversationId: conv.id,
                messageId: user1Id,
                parts: [{ type: 'text', text: 'first' }],
            }),
            { prisma, model: makeStreamModel('Reply one') },
        )
        expect(res1.status).toBe(200)
        const reader1 = res1.body!.getReader()
        while (!(await reader1.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 80))

        let msgs = await listMessages(prisma, conv.id)
        expect(msgs).toHaveLength(2)
        expect(msgs[0].role).toBe('USER')
        expect(msgs[1].role).toBe('ASSISTANT')
        const asst1Id = msgs[1].id

        const user2Id = 'client-u-two-turn-2'
        const res2 = await handleChatPost(
            makeRequest({
                kind: 'user-turn',
                conversationId: conv.id,
                messageId: user2Id,
                parts: [{ type: 'text', text: 'second' }],
            }),
            { prisma, model: makeStreamModel('Reply two') },
        )
        expect(res2.status).toBe(200)
        const reader2 = res2.body!.getReader()
        while (!(await reader2.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 80))

        msgs = await listMessages(prisma, conv.id)
        expect(msgs).toHaveLength(4)
        expect(msgs.map(m => m.role)).toEqual(['USER', 'ASSISTANT', 'USER', 'ASSISTANT'])
        expect(msgs[1].id).toBe(asst1Id)
        expect(textFromMessagePayload(msgs[1])).toContain('Reply one')
        expect(msgs[3].id).not.toBe(asst1Id)
        expect(textFromMessagePayload(msgs[3])).toContain('Reply two')
    })

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
                kind: 'user-turn',
                conversationId: conv.id,
                messageId: userMsgId,
                parts: [{ type: 'text', text: 'only-from-body' }],
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
        expect(textFromMessagePayload(row!)).toContain('only-from-body')
    })

    it('returns 400 when conversationId missing', async () => {
        const res = await handleChatPost(makeRequest({}), { prisma })
        expect(res.status).toBe(400)
    })

    it('returns 400 when no LLM selection', async () => {
        const conv = await createConversation(prisma)
        const res = await handleChatPost(
            makeRequest({
                kind: 'user-turn',
                conversationId: conv.id,
                messageId: 'u-x',
                parts: [{ type: 'text', text: 'hi' }],
            }),
            { prisma },
        )
        expect(res.status).toBe(400)
    })

    it('returns 400 when user message id belongs to another conversation', async () => {
        const a = await setupConversationWithLlm()
        const b = await setupConversationWithLlm()
        const res = await handleChatPost(
            makeRequest({
                kind: 'user-turn',
                conversationId: b.conv.id,
                messageId: a.userMessageId,
                parts: [{ type: 'text', text: 'hi' }],
            }),
            { prisma, model: makeStreamModel('x') },
        )
        expect(res.status).toBe(400)
        const json = await res.json() as { error?: string }
        expect(json.error).toContain('不属于本会话')
    })

    it('streams a response with UI message stream headers', async () => {
        const { conv, userMessageId } = await setupConversationWithLlm()
        const mockModel = makeStreamModel('Hello world')

        const res = await handleChatPost(
            makeRequest({
                kind: 'user-turn',
                conversationId: conv.id,
                messageId: userMessageId,
                parts: [{ type: 'text', text: 'hello' }],
            }),
            { prisma, model: mockModel },
        )

        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/event-stream')
        const reader = res.body!.getReader()
        while (!(await reader.read()).done) { /* drain：避免未完成流影响同库后续用例 */ }
    })

    it('writes usage to db via onStepFinish', async () => {
        const { conv, userMessageId } = await setupConversationWithLlm()
        const mockModel = makeStreamModel('hi')

        const res = await handleChatPost(
            makeRequest({
                kind: 'user-turn',
                conversationId: conv.id,
                messageId: userMessageId,
                parts: [{ type: 'text', text: 'hello' }],
            }),
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
        const { conv, userMessageId } = await setupConversationWithLlm()

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
            makeRequest({
                kind: 'user-turn',
                conversationId: conv.id,
                messageId: userMessageId,
                parts: [{ type: 'text', text: 'hello' }],
            }),
            { prisma, model: mockModel, toolsOverride: { 'echo-tool': echoTool } },
        )

        const reader = res.body!.getReader()
        while (!(await reader.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 100))

        const msgs = await listMessages(prisma, conv.id)
        const assistant = msgs.find(m => m.role === 'ASSISTANT')
        expect(assistant).toBeDefined()
        const parts = (assistant!.payload as { parts: Array<{ type: string, state?: string }> }).parts
        const toolPart = parts.find(p => p.type === 'tool-echo-tool')
        expect(toolPart).toBeDefined()
        expect(toolPart?.state).toBe('output-available')
    })

    it('tool error → onStepFinish writes output-error part to DB', async () => {
        const { conv, userMessageId } = await setupConversationWithLlm()

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
            makeRequest({
                kind: 'user-turn',
                conversationId: conv.id,
                messageId: userMessageId,
                parts: [{ type: 'text', text: 'hello' }],
            }),
            { prisma, model: mockModel, toolsOverride: { 'fail-tool': failTool } },
        )

        const reader = res.body!.getReader()
        while (!(await reader.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 100))

        const msgs = await listMessages(prisma, conv.id)
        const assistant = msgs.find(m => m.role === 'ASSISTANT')
        expect(assistant).toBeDefined()
        const parts = (assistant!.payload as { parts: Array<{ type: string, state?: string, errorText?: string }> }).parts
        const toolPart = parts.find(p => p.type === 'tool-fail-tool')
        expect(toolPart?.state).toBe('output-error')
        expect(toolPart?.errorText).toContain('failed')
    })

    it('tool-approval: HTTP 拒绝合并进 assistant payload 后可完成流', async () => {
        const { conv, llmModel } = await setupConversationWithLlm()
        const asstId = 'asst-tool-approval-route-1'
        await prisma.message.create({
            data: {
                id: asstId,
                conversationId: conv.id,
                role: 'ASSISTANT',
                payload: {
                    role: 'assistant',
                    parts: [
                        {
                            type: 'dynamic-tool',
                            toolName: 'image-generate-primary',
                            toolCallId: 'tc-ap-1',
                            state: 'approval-requested',
                            input: { prompt: 'x' },
                            approval: { id: 'ap-int-1' },
                        },
                    ],
                    metadata: {
                        usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
                        modelIdAtTime: llmModel.id,
                    },
                },
            },
        })

        const res = await handleChatPost(
            makeRequest({
                kind: 'tool-approval',
                conversationId: conv.id,
                assistantMessageId: asstId,
                approvals: [{ approvalId: 'ap-int-1', approved: false, reason: '集成测拒绝' }],
            }),
            { prisma, model: makeStreamModel('好的，已了解。') },
        )
        expect(res.status).toBe(200)
        const reader = res.body!.getReader()
        while (!(await reader.read()).done) { /* drain */ }
        await new Promise(r => setTimeout(r, 80))

        const row = await prisma.message.findUnique({ where: { id: asstId } })
        const parts = (row!.payload as { parts: Array<{ type: string, state?: string, approval?: { reason?: string } }> }).parts
        const toolPart = parts.find(p => (p as { type: string }).type === 'dynamic-tool')
        expect(toolPart?.state).toBe('output-denied')
        expect((toolPart as { approval?: { approved?: boolean, reason?: string } }).approval).toMatchObject({
            approved: false,
            reason: '集成测拒绝',
        })
    })
})
