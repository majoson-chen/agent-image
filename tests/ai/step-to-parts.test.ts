import { appendStepToParts } from '@lib/ai/step-to-parts'
/**
 * U5 — step-to-parts 纯函数单测（test-first）
 * 验证 StepResult.content → UIMessagePart[] 转换逻辑
 */
import { describe, expect, it } from 'vitest'

// 最小化 StepResult 工厂
function makeStep(content: unknown[]) {
    return { content } as unknown as Parameters<typeof appendStepToParts>[1]
}

describe('appendStepToParts', () => {
    it('text step → step-start + text part', () => {
        const step = makeStep([{ type: 'text', text: 'Hello world' }])
        const result = appendStepToParts([], step)
        expect(result).toHaveLength(2)
        expect(result[0]!.type).toBe('step-start')
        expect(result[1]!).toMatchObject({ type: 'text', text: 'Hello world' })
    })

    it('tool-call + tool-result → step-start + output-available part', () => {
        const step = makeStep([
            { type: 'tool-call', toolCallId: 'tc1', toolName: 'web-fetch', input: { url: 'https://example.com' } },
            { type: 'tool-result', toolCallId: 'tc1', toolName: 'web-fetch', input: { url: 'https://example.com' }, output: { status: 200, text: 'page content' } },
        ])
        const result = appendStepToParts([], step)
        expect(result).toHaveLength(2)
        expect(result[0]!.type).toBe('step-start')
        expect(result[1]!).toMatchObject({
            type: 'tool-web-fetch',
            state: 'output-available',
            toolCallId: 'tc1',
        })
    })

    it('tool-call + tool-error → step-start + output-error part', () => {
        const step = makeStep([
            { type: 'tool-call', toolCallId: 'tc2', toolName: 'web-search', input: { query: 'test' } },
            { type: 'tool-error', toolCallId: 'tc2', toolName: 'web-search', input: { query: 'test' }, error: new Error('fetch 500') },
        ])
        const result = appendStepToParts([], step)
        expect(result).toHaveLength(2)
        expect(result[1]!).toMatchObject({
            type: 'tool-web-search',
            state: 'output-error',
            toolCallId: 'tc2',
        })
        expect((result[1] as unknown as { errorText: string }).errorText).toContain('fetch 500')
    })

    it('appends to existing parts (accumulate across steps)', () => {
        const prev = [
            { type: 'step-start' },
            { type: 'text', text: 'Step 1' },
        ]
        const step = makeStep([{ type: 'text', text: 'Step 2' }])
        const result = appendStepToParts(prev as never, step)
        expect(result).toHaveLength(4)
        expect(result[3]!).toMatchObject({ type: 'text', text: 'Step 2' })
    })

    it('empty content step → only step-start', () => {
        const step = makeStep([])
        const result = appendStepToParts([], step)
        expect(result).toHaveLength(1)
        expect(result[0]!.type).toBe('step-start')
    })

    it('preserves reasoning before text', () => {
        const step = makeStep([
            { type: 'reasoning', text: 'thinking...' },
            { type: 'text', text: 'Answer' },
        ])
        const result = appendStepToParts([], step)
        expect(result).toEqual([
            { type: 'step-start' },
            { type: 'reasoning', text: 'thinking...' },
            { type: 'text', text: 'Answer' },
        ])
    })
})
