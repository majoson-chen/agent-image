import { modelCreateBodySchema } from '@lib/validation/model-upsert-schema'
/**
 * U2 — modelCreateBodySchema discriminated union 测试（register 架构）
 */
import { describe, expect, it } from 'vitest'

describe('modelCreateBodySchema discriminated union', () => {
    it('accepts LLM input', () => {
        const result = modelCreateBodySchema.safeParse({
            type: 'LLM',
            registerId: 'openai/official',
            name: 'GPT-4o',
            config: { modelId: 'gpt-4o', apiKey: 'sk-test' },
        })
        expect(result.success).toBe(true)
    })

    it('accepts ALIBABA LLM input without baseURL', () => {
        const result = modelCreateBodySchema.safeParse({
            type: 'LLM',
            registerId: 'alibaba/dashscope-llm',
            name: 'qwen-plus',
            config: { modelId: 'qwen-plus', apiKey: 'sk-dash' },
        })
        expect(result.success).toBe(true)
    })

    it('accepts SEARCH input', () => {
        const result = modelCreateBodySchema.safeParse({
            type: 'SEARCH',
            registerId: 'brave/search',
            name: 'Brave',
            config: { apiKey: 'BSA-token' },
        })
        expect(result.success).toBe(true)
    })

    it('rejects unknown type', () => {
        const result = modelCreateBodySchema.safeParse({
            type: 'OTHER',
            registerId: 'openai/official',
            name: 'Bad',
            config: { modelId: 'x', apiKey: 'sk-test' },
        })
        expect(result.success).toBe(false)
    })
})
