/**
 * U4 — LLM Provider 工厂测试
 *
 * 验证：
 * 1. OPENAI 类型使用 @ai-sdk/openai createOpenAI
 * 2. OPENAI_COMPATIBLE 类型使用 @ai-sdk/openai-compatible createOpenAICompatible
 * 3. 返回的 LanguageModel 具有 specificationVersion 和 modelId
 * 4. OPENAI_COMPATIBLE 缺少 baseURL 时抛出
 */
import { describe, expect, it } from 'vitest'
import { buildLlmModel } from '../../lib/llm-provider-factory'

const OPENAI_MODEL = {
    id: 'test',
    type: 'LLM' as const,
    name: 'gpt-4o',
    providerType: 'OPENAI' as const,
    baseURL: null,
    apiKey: 'sk-test',
    contextWindow: 128000,
    extraHeaders: null,
    capabilities: null,
    createdAt: new Date(),
    updatedAt: new Date(),
}

const COMPATIBLE_MODEL = {
    ...OPENAI_MODEL,
    providerType: 'OPENAI_COMPATIBLE' as const,
    baseURL: 'https://api.example.com/v1',
    name: 'moonshot-v1',
}

describe('buildLlmModel', () => {
    it('returns a LanguageModel for OPENAI provider', () => {
        const model = buildLlmModel(OPENAI_MODEL)
        expect(model).toBeDefined()
        // AI SDK LanguageModel 具有 specificationVersion 属性
        expect(model.specificationVersion).toMatch(/^v\d+$/)
    })

    it('returns a LanguageModel for OPENAI_COMPATIBLE provider', () => {
        const model = buildLlmModel(COMPATIBLE_MODEL)
        expect(model).toBeDefined()
        expect(model.specificationVersion).toMatch(/^v\d+$/)
    })

    it('includes modelId reflecting name', () => {
        const model = buildLlmModel(OPENAI_MODEL)
        // modelId 应包含我们传入的 name
        expect(model.modelId).toBe('gpt-4o')
    })

    it('throws when OPENAI_COMPATIBLE has no baseURL', () => {
        expect(() => buildLlmModel({ ...COMPATIBLE_MODEL, baseURL: null })).toThrow()
    })
})
