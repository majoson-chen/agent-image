/**
 * SPEC G4：`buildLlmLanguageModel` 与多 Register 选型。
 */
import { buildLlmLanguageModel } from '@lib/providers/runtime/build-llm-from-model'
import { describe, expect, it } from 'vitest'

describe('buildLlmLanguageModel', () => {
    it('throws for unknown LLM registerId', () => {
        expect(() =>
            buildLlmLanguageModel({
                id: 'x',
                type: 'LLM',
                name: 'n',
                registerId: 'acme/nonexistent',
                config: {},
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
        ).toThrow(/unknown LLM registerId/)
    })
})

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

describe('buildLlmLanguageModel register dispatch', () => {
    it('returns a LanguageModel for openai/official register', () => {
        const model = buildLlmLanguageModel(OPENAI_MODEL)
        expect(model).toBeDefined()
        expect(model.specificationVersion).toMatch(/^v\d+$/)
    })

    it('returns a LanguageModel for openai-compatible/generic register', () => {
        const model = buildLlmLanguageModel(COMPATIBLE_MODEL)
        expect(model).toBeDefined()
        expect(model.specificationVersion).toMatch(/^v\d+$/)
    })

    it('returns a LanguageModel for alibaba/dashscope-llm register', () => {
        const model = buildLlmLanguageModel(ALIBABA_MODEL)
        expect(model).toBeDefined()
        expect(model.specificationVersion).toMatch(/^v\d+$/)
    })

    it('includes modelId reflecting config.modelId', () => {
        const model = buildLlmLanguageModel(OPENAI_MODEL)
        expect(model.modelId).toBe('gpt-4o')
    })

    it('includes Alibaba modelId reflecting config.modelId', () => {
        const model = buildLlmLanguageModel(ALIBABA_MODEL)
        expect(model.modelId).toBe('qwen-plus')
    })

    it('uses fixed modelId for Kimi K2.6 SKU', () => {
        const model = buildLlmLanguageModel({
            ...ALIBABA_MODEL,
            registerId: 'alibaba/dashscope-kimi-k2-6',
            config: { apiKey: 'sk-test' },
        })
        expect(model.modelId).toBe('kimi-k2.6')
    })

    it('uses fixed modelId for Qwen 3.6 Plus SKU', () => {
        const model = buildLlmLanguageModel({
            ...ALIBABA_MODEL,
            registerId: 'alibaba/dashscope-qwen3-6-plus',
            config: { apiKey: 'sk-test' },
        })
        expect(model.modelId).toBe('qwen3.6-plus')
    })

    it('throws when openai-compatible/generic has no baseURL', () => {
        expect(() => buildLlmLanguageModel({ ...COMPATIBLE_MODEL, config: { modelId: 'x', apiKey: 'k' } })).toThrow()
    })
})
