import { describe, expect, it } from 'vitest'
import { llmModelInputSchema } from '../../lib/validation/llm-model-schema'

describe('llmModelInputSchema', () => {
    it('accepts valid OPENAI model', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'gpt-4o',
            providerType: 'OPENAI',
            apiKey: 'sk-test',
            contextWindow: 128000,
        })
        expect(result.success).toBe(true)
    })

    it('accepts valid OPENAI_COMPATIBLE model with baseURL', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'moonshot',
            providerType: 'OPENAI_COMPATIBLE',
            baseURL: 'https://api.moonshot.cn/v1',
            apiKey: 'sk-moon',
            contextWindow: 8000,
        })
        expect(result.success).toBe(true)
    })

    it('accepts valid ALIBABA model without baseURL', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'qwen-plus',
            providerType: 'ALIBABA',
            apiKey: 'sk-dash',
            contextWindow: 128000,
        })
        expect(result.success).toBe(true)
    })

    it('accepts valid ALIBABA model with baseURL', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'qwen-plus',
            providerType: 'ALIBABA',
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            apiKey: 'sk-dash',
            contextWindow: 128000,
        })
        expect(result.success).toBe(true)
    })

    it('rejects ALIBABA with empty baseURL string', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'qwen-plus',
            providerType: 'ALIBABA',
            baseURL: '',
            apiKey: 'sk-dash',
            contextWindow: 128000,
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty apiKey', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'x',
            providerType: 'OPENAI',
            apiKey: '',
            contextWindow: 1000,
        })
        expect(result.success).toBe(false)
    })

    it('rejects contextWindow of 0', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'x',
            providerType: 'OPENAI',
            apiKey: 'sk',
            contextWindow: 0,
        })
        expect(result.success).toBe(false)
    })

    it('rejects contextWindow of negative number', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'x',
            providerType: 'OPENAI',
            apiKey: 'sk',
            contextWindow: -1,
        })
        expect(result.success).toBe(false)
    })

    it('rejects OPENAI_COMPATIBLE without baseURL', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'x',
            providerType: 'OPENAI_COMPATIBLE',
            apiKey: 'sk',
            contextWindow: 1000,
        })
        expect(result.success).toBe(false)
    })

    it('rejects OPENAI_COMPATIBLE with empty baseURL', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'x',
            providerType: 'OPENAI_COMPATIBLE',
            baseURL: '',
            apiKey: 'sk',
            contextWindow: 1000,
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty name', () => {
        const result = llmModelInputSchema.safeParse({
            name: '',
            providerType: 'OPENAI',
            apiKey: 'sk',
            contextWindow: 1000,
        })
        expect(result.success).toBe(false)
    })

    it('accepts optional extraHeaders as record', () => {
        const result = llmModelInputSchema.safeParse({
            name: 'x',
            providerType: 'OPENAI',
            apiKey: 'sk',
            contextWindow: 1000,
            extraHeaders: { 'X-Custom': 'value' },
        })
        expect(result.success).toBe(true)
    })
})
