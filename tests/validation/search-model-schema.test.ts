import { searchModelInputSchema } from '@lib/validation/search-model-schema'
/**
 * U2 — search-model-schema zod 校验测试（test-first）
 */
import { describe, expect, it } from 'vitest'

describe('searchModelInputSchema', () => {
    it('accepts valid Brave Search input', () => {
        const result = searchModelInputSchema.safeParse({
            type: 'SEARCH',
            providerType: 'BRAVE_SEARCH',
            name: 'Brave',
            apiKey: 'BSA-token',
        })
        expect(result.success).toBe(true)
    })

    it('rejects empty apiKey', () => {
        const result = searchModelInputSchema.safeParse({
            type: 'SEARCH',
            providerType: 'BRAVE_SEARCH',
            name: 'Brave',
            apiKey: '',
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty name', () => {
        const result = searchModelInputSchema.safeParse({
            type: 'SEARCH',
            providerType: 'BRAVE_SEARCH',
            name: '',
            apiKey: 'BSA-token',
        })
        expect(result.success).toBe(false)
    })

    it('rejects wrong providerType for SEARCH type', () => {
        const result = searchModelInputSchema.safeParse({
            type: 'SEARCH',
            providerType: 'OPENAI',
            name: 'Test',
            apiKey: 'sk-test',
        })
        expect(result.success).toBe(false)
    })
})
