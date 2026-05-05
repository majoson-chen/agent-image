/**
 * repairDanglingImageGenerateToolParts：防止未完成生图 tool 与后续 user 并排时触发 MissingToolResultsError。
 */
import { convertToModelMessages, generateText } from 'ai'
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { repairDanglingImageGenerateToolParts } from '@lib/ai/repair-dangling-image-generate-parts'

function mockLlm(): MockLanguageModelV3 {
    return new MockLanguageModelV3({
        doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            content: [{ type: 'text', text: 'ok' }],
            warnings: [],
        }),
        doStream: async () => ({
            stream: convertArrayToReadableStream([
                { type: 'text-start', id: 't1' },
                { type: 'text-delta', id: 't1', delta: 'ok' },
                { type: 'text-end', id: 't1' },
                {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: {
                        inputTokens: { total: 1 },
                        outputTokens: { total: 1 },
                    },
                },
            ]),
            response: { headers: {} },
        }),
    } as never)
}

describe('repairDanglingImageGenerateToolParts', () => {
    const danglingHistory = [
        {
            id: 'u-1',
            role: 'user' as const,
            parts: [{ type: 'text', text: '画一张图' }],
        },
        {
            id: 'a-1',
            role: 'assistant' as const,
            parts: [
                { type: 'step-start' },
                {
                    type: 'tool-image-generate-primary',
                    state: 'approval-requested',
                    toolCallId: 'functions.image-generate-primary:2',
                    toolName: 'image-generate-primary',
                    input: { prompt: 'test' },
                    approval: { id: 'ap-1' },
                },
            ],
        },
        {
            id: 'u-2',
            role: 'user' as const,
            parts: [{ type: 'text', text: '换一句话' }],
        },
    ]

    it('将 approval-requested 规范为 output-denied', () => {
        const out = repairDanglingImageGenerateToolParts(danglingHistory)
        const asst = out.find(m => m.id === 'a-1')!
        const tool = asst.parts.find(p => (p as { type?: string }).type === 'tool-image-generate-primary') as {
            state: string
            approval?: { approved?: boolean }
        }
        expect(tool.state).toBe('output-denied')
        expect(tool.approval?.approved).toBe(false)
    })

    it('未修复时 generateText 抛出 MissingToolResultsError', async () => {
        const messages = await convertToModelMessages(danglingHistory as never, { tools: {} })
        await expect(
            generateText({
                model: mockLlm() as never,
                messages,
                maxOutputTokens: 10,
            }),
        ).rejects.toThrow(/Tool result.*missing/i)
    })

    it('修复后 generateText 不因 MissingToolResultsError 失败', async () => {
        const repaired = repairDanglingImageGenerateToolParts(danglingHistory)
        const messages = await convertToModelMessages(repaired as never, { tools: {} })
        await expect(
            generateText({
                model: mockLlm() as never,
                messages,
                maxOutputTokens: 10,
            }),
        ).resolves.toBeDefined()
    })

    it('tool-approval 后 approval-responded（已批准）且无后续 user：不改为 output-denied', () => {
        const afterApprove = [
            {
                id: 'u-1',
                role: 'user' as const,
                parts: [{ type: 'text', text: '画奶龙' }],
            },
            {
                id: 'a-1',
                role: 'assistant' as const,
                parts: [
                    {
                        type: 'tool-image-generate-primary',
                        state: 'approval-responded',
                        toolCallId: 'functions.image-generate-primary:2',
                        toolName: 'image-generate-primary',
                        input: { prompt: '奶龙' },
                        approval: { id: 'ap-1', approved: true },
                    },
                ],
            },
        ]
        const out = repairDanglingImageGenerateToolParts(afterApprove)
        const tool = out.find(m => m.id === 'a-1')!.parts[0] as { state: string }
        expect(tool.state).toBe('approval-responded')
    })
})
