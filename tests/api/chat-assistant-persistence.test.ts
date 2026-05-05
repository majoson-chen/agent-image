import { appendStepToParts, patchToolResultsFromResponseMessages } from '@lib/ai/step-to-parts'
/**
 * U2 — assistant tool-image-generate 持久化丢失 output 的 characterization 测试
 *
 * 当前坏行为：跨请求的审批流程中（Request 1：LLM 生成 tool-call → 待审批；
 * Request 2：审批通过，工具执行，LLM 回复），Request 2 的 onStepFinish 只
 * 看到 step.content = [text]，无法关联到 tool-call，导致 DB 里 tool part
 * 停在 state:'input-available'，imageId 丢失。
 *
 * 修复后行为：通过 patchToolResultsFromResponseMessages 将
 * step.response.messages 中的 tool-result 回写到 runningParts。
 */
import { describe, expect, it } from 'vitest'

describe('patchToolResultsFromResponseMessages', () => {
    it('cross-step: patches input-available part with output from response.messages', () => {
        // 模拟 runningParts: Request 1 已写入 input-available 的 image-generate 工具 part
        const runningParts = [
            { type: 'step-start' },
            {
                type: 'tool-image-generate-primary',
                state: 'input-available',
                toolCallId: 'tc-1',
                input: { prompt: '一只猫' },
            },
        ]

        // 模拟 step.response.messages：工具执行后 tool-message 包含结果
        const responseMessages = [
            {
                role: 'tool' as const,
                content: [
                    {
                        type: 'tool-result' as const,
                        toolCallId: 'tc-1',
                        toolName: 'image-generate-primary',
                        output: { type: 'json' as const, value: { imageId: 'img-001', mimeType: 'image/png', sizeBytes: 1000 } },
                    },
                ],
            },
            {
                role: 'assistant' as const,
                content: [{ type: 'text' as const, text: '图已生成！' }],
            },
        ]

        // 当前实现下此函数不存在 → 测试将失败
        const patched = patchToolResultsFromResponseMessages(runningParts as never, responseMessages as never)

        const toolPart = patched.find(p => (p as { type: string }).type === 'tool-image-generate-primary') as {
            type: string
            state: string
            output?: { imageId?: string }
        }
        expect(toolPart).toBeDefined()
        expect(toolPart.state).toBe('output-available')
        expect(toolPart.output?.imageId).toBe('img-001')
    })

    it('cross-step: patches approval-responded (approved) part with output from response.messages', () => {
        const runningParts = [
            { type: 'step-start' },
            {
                type: 'tool-image-generate-primary',
                state: 'approval-responded',
                toolCallId: 'tc-ar-1',
                input: { prompt: '一只猫' },
                approval: { id: 'ap-x', approved: true },
            },
        ]

        const responseMessages = [
            {
                role: 'tool' as const,
                content: [
                    {
                        type: 'tool-result' as const,
                        toolCallId: 'tc-ar-1',
                        toolName: 'image-generate-primary',
                        output: { type: 'json' as const, value: { imageId: 'img-ar', mimeType: 'image/png', sizeBytes: 1000 } },
                    },
                ],
            },
        ]

        const patched = patchToolResultsFromResponseMessages(runningParts as never, responseMessages as never)
        const toolPart = patched.find(p => (p as { type: string }).type === 'tool-image-generate-primary') as {
            state: string
            output?: { imageId?: string }
        }
        expect(toolPart.state).toBe('output-available')
        expect(toolPart.output?.imageId).toBe('img-ar')
    })

    it('does not patch output-available parts (idempotent)', () => {
        const runningParts = [
            {
                type: 'tool-image-generate-primary',
                state: 'output-available',
                toolCallId: 'tc-2',
                input: { prompt: 'cat' },
                output: { imageId: 'already-done' },
            },
        ]

        const responseMessages = [
            {
                role: 'tool' as const,
                content: [
                    {
                        type: 'tool-result' as const,
                        toolCallId: 'tc-2',
                        toolName: 'image-generate-primary',
                        output: { type: 'json' as const, value: { imageId: 'new-id' } },
                    },
                ],
            },
        ]

        const patched = patchToolResultsFromResponseMessages(runningParts as never, responseMessages as never)
        const toolPart = patched.find(p => (p as { type: string }).type === 'tool-image-generate-primary') as {
            output?: { imageId?: string }
        }
        // 不应覆盖已有结果
        expect(toolPart.output?.imageId).toBe('already-done')
    })

    it('handles execution-denied as output-error', () => {
        const runningParts = [
            {
                type: 'tool-image-generate-primary',
                state: 'input-available',
                toolCallId: 'tc-3',
                input: { prompt: 'cat' },
            },
        ]

        const responseMessages = [
            {
                role: 'tool' as const,
                content: [
                    {
                        type: 'tool-result' as const,
                        toolCallId: 'tc-3',
                        toolName: 'image-generate-primary',
                        output: { type: 'execution-denied' as const, reason: '用户拒绝' },
                    },
                ],
            },
        ]

        const patched = patchToolResultsFromResponseMessages(runningParts as never, responseMessages as never)
        const toolPart = patched.find(p => (p as { type: string }).type === 'tool-image-generate-primary') as {
            state: string
            errorText?: string
        }
        expect(toolPart.state).toBe('output-error')
        expect(toolPart.errorText).toContain('拒绝')
    })

    it('returns unchanged parts when no matching response messages', () => {
        const runningParts = [
            { type: 'step-start' },
            { type: 'text', text: 'hello' },
        ]

        const patched = patchToolResultsFromResponseMessages(runningParts as never, [])

        expect(patched).toEqual(runningParts)
    })
})

describe('appendStepToParts (same-step, existing behavior)', () => {
    it('tool-call without result: input-available 继承同 toolCallId 上一条的 approval', () => {
        const prev = [
            { type: 'step-start' },
            {
                type: 'tool-image-generate-primary',
                state: 'approval-requested',
                toolCallId: 'tc-ap',
                input: { prompt: 'cat' },
                approval: { id: 'ap-99' },
            },
        ]
        const step = {
            content: [
                { type: 'tool-call', toolCallId: 'tc-ap', toolName: 'image-generate-primary', input: { prompt: 'cat' } },
            ],
        }
        const result = appendStepToParts(prev as never, step as never)
        const toolPart = result.find(p => (p as { type: string }).type === 'tool-image-generate-primary' && (p as { state: string }).state === 'input-available') as {
            approval?: { id: string }
        }
        expect(toolPart?.approval?.id).toBe('ap-99')
    })

    it('tool-call + tool-result in same step → output-available (regression)', () => {
        const step = {
            content: [
                { type: 'tool-call', toolCallId: 'tc-same', toolName: 'echo-tool', input: { x: 1 } },
                { type: 'tool-result', toolCallId: 'tc-same', toolName: 'echo-tool', input: { x: 1 }, output: { y: 2 } },
            ],
        }

        const result = appendStepToParts([], step as never)
        const toolPart = result.find(p => p.type === 'tool-echo-tool') as { state: string, output?: { y?: number } }
        expect(toolPart?.state).toBe('output-available')
        expect(toolPart?.output?.y).toBe(2)
    })
})
