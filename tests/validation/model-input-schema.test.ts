/**
 * U2 — model-input-schema discriminated union 测试（test-first）
 */
import { describe, expect, it } from 'vitest'
import { modelInputSchema } from '../../lib/validation/model-input-schema'

describe('modelInputSchema discriminated union', () => {
    it('accepts LLM input', () => {
        const result = modelInputSchema.safeParse({
            type: 'LLM',
            providerType: 'OPENAI',
            name: 'GPT-4o',
            apiKey: 'sk-test',
            contextWindow: 128000,
        })
        expect(result.success).toBe(true)
    })

    it('accepts SEARCH input', () => {
        const result = modelInputSchema.safeParse({
            type: 'SEARCH',
            providerType: 'BRAVE_SEARCH',
            name: 'Brave',
            apiKey: 'BSA-token',
        })
        expect(result.success).toBe(true)
    })

    it('rejects LLM input with BRAVE_SEARCH providerType', () => {
        const result = modelInputSchema.safeParse({
            type: 'LLM',
            providerType: 'BRAVE_SEARCH',
            name: 'Bad',
            apiKey: 'sk-test',
            contextWindow: 1000,
        })
        expect(result.success).toBe(false)
    })

    it('rejects SEARCH input with OPENAI providerType', () => {
        const result = modelInputSchema.safeParse({
            type: 'SEARCH',
            providerType: 'OPENAI',
            name: 'Bad',
            apiKey: 'sk-test',
        })
        expect(result.success).toBe(false)
    })
})
