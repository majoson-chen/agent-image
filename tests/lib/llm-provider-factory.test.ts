import { buildLlmModel } from '@lib/llm-provider-factory'
/**
 * U4 — LLM Provider 工厂测试
 *
 * 验证：
 * 1. openai/official 使用 @ai-sdk/openai createOpenAI
 * 2. openai-compatible/generic 使用 @ai-sdk/openai-compatible createOpenAICompatible
 * 3. alibaba/dashscope-llm 使用 @ai-sdk/alibaba createAlibaba
 * 4. 返回的 LanguageModel 具有 specificationVersion 和 modelId
 * 5. OPENAI_COMPATIBLE 缺少 baseURL 时抛出
 */
import { describe, expect, it } from 'vitest'

const OPENAI_MODEL = {
    id: 'test',
    type: 'LLM' as const,
    name: 'OpenAI 展示名',
    registerId: 'openai/official',
    config: { modelId: 'gpt-4o', apiKey: 'sk-test' },
    createdAt: new Date(),
    updatedAt: new Date(),
}

const COMPATIBLE_MODEL = {
    ...OPENAI_MODEL,
    registerId: 'openai-compatible/generic',
    name: 'Moonshot 展示名',
    config: { modelId: 'moonshot-v1', baseURL: 'https://api.example.com/v1', apiKey: 'sk-test' },
}

const ALIBABA_MODEL = {
    ...OPENAI_MODEL,
    registerId: 'alibaba/dashscope-llm',
    name: 'Qwen 展示名',
    config: { modelId: 'qwen-plus', apiKey: 'sk-test' },
}

describe('buildLlmModel', () => {
    it('returns a LanguageModel for openai/official register', () => {
        const model = buildLlmModel(OPENAI_MODEL)
        expect(model).toBeDefined()
        // AI SDK LanguageModel 具有 specificationVersion 属性
        expect(model.specificationVersion).toMatch(/^v\d+$/)
    })

    it('returns a LanguageModel for openai-compatible/generic register', () => {
        const model = buildLlmModel(COMPATIBLE_MODEL)
        expect(model).toBeDefined()
        expect(model.specificationVersion).toMatch(/^v\d+$/)
    })

    it('returns a LanguageModel for alibaba/dashscope-llm register', () => {
        const model = buildLlmModel(ALIBABA_MODEL)
        expect(model).toBeDefined()
        expect(model.specificationVersion).toMatch(/^v\d+$/)
    })

    it('includes modelId reflecting config.modelId', () => {
        const model = buildLlmModel(OPENAI_MODEL)
        expect(model.modelId).toBe('gpt-4o')
    })

    it('includes Alibaba modelId reflecting config.modelId', () => {
        const model = buildLlmModel(ALIBABA_MODEL)
        expect(model.modelId).toBe('qwen-plus')
    })

    it('uses fixed modelId for Kimi K2.6 SKU', () => {
        const model = buildLlmModel({
            ...ALIBABA_MODEL,
            registerId: 'alibaba/dashscope-kimi-k2-6',
            config: { apiKey: 'sk-test' },
        })
        expect(model.modelId).toBe('kimi-k2.6')
    })

    it('uses fixed modelId for Qwen 3.6 Plus SKU', () => {
        const model = buildLlmModel({
            ...ALIBABA_MODEL,
            registerId: 'alibaba/dashscope-qwen3-6-plus',
            config: { apiKey: 'sk-test' },
        })
        expect(model.modelId).toBe('qwen3.6-plus')
    })

    it('throws when openai-compatible/generic has no baseURL', () => {
        expect(() => buildLlmModel({ ...COMPATIBLE_MODEL, config: { modelId: 'x', apiKey: 'k' } })).toThrow()
    })
})
