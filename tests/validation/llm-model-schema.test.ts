import { parseModelConfig } from '@lib/providers/register-metadata'
import { describe, expect, it } from 'vitest'

describe('LLM register config schemas', () => {
    it('accepts valid OpenAI official config', () => {
        expect(parseModelConfig('openai/official', {
            modelId: 'gpt-4o',
            apiKey: 'sk-test',
        })).toMatchObject({ modelId: 'gpt-4o' })
    })

    it('accepts valid OpenAI compatible config with baseURL', () => {
        expect(parseModelConfig('openai-compatible/generic', {
            modelId: 'moonshot',
            baseURL: 'https://api.moonshot.cn/v1',
            apiKey: 'sk-moon',
        })).toMatchObject({ baseURL: 'https://api.moonshot.cn/v1' })
    })

    it('accepts valid Alibaba config without baseURL', () => {
        expect(parseModelConfig('alibaba/dashscope-llm', {
            modelId: 'qwen-plus',
            apiKey: 'sk-dash',
        })).toMatchObject({ modelId: 'qwen-plus' })
    })

    it('accepts SKU registers with apiKey only', () => {
        expect(parseModelConfig('alibaba/dashscope-kimi-k2-6', {
            apiKey: 'sk',
        })).toMatchObject({ apiKey: 'sk' })
        expect(parseModelConfig('alibaba/dashscope-qwen3-6-plus', {
            apiKey: 'sk',
        })).toMatchObject({ apiKey: 'sk' })
    })

    it('accepts SKU with thinkingBudget', () => {
        expect(parseModelConfig('alibaba/dashscope-kimi-k2-6', {
            apiKey: 'sk',
            capabilities: { thinkingBudget: 5000 },
        })).toMatchObject({ capabilities: { thinkingBudget: 5000 } })
    })

    it('accepts SKU with explicit supportsThinking true', () => {
        expect(parseModelConfig('alibaba/dashscope-kimi-k2-6', {
            apiKey: 'sk',
            capabilities: { supportsThinking: true },
        })).toMatchObject({ capabilities: { supportsThinking: true } })
    })

    it('accepts valid Alibaba config with baseURL and capabilities', () => {
        expect(parseModelConfig('alibaba/dashscope-llm', {
            modelId: 'qwen-plus',
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            apiKey: 'sk-dash',
            capabilities: { supportsThinking: true },
        })).toMatchObject({ capabilities: { supportsThinking: true } })
    })

    it('rejects Alibaba with empty baseURL string', () => {
        expect(() => parseModelConfig('alibaba/dashscope-llm', {
            modelId: 'qwen-plus',
            baseURL: '',
            apiKey: 'sk-dash',
        })).toThrow()
    })

    it('rejects empty apiKey', () => {
        expect(() => parseModelConfig('openai/official', {
            modelId: 'x',
            apiKey: '',
        })).toThrow()
    })

    it('rejects OpenAI compatible without baseURL', () => {
        expect(() => parseModelConfig('openai-compatible/generic', {
            modelId: 'x',
            apiKey: 'sk',
        })).toThrow()
    })

    it('rejects OpenAI compatible with empty baseURL', () => {
        expect(() => parseModelConfig('openai-compatible/generic', {
            modelId: 'x',
            baseURL: '',
            apiKey: 'sk',
        })).toThrow()
    })

    it('rejects empty modelId', () => {
        expect(() => parseModelConfig('openai/official', {
            modelId: '',
            apiKey: 'sk',
        })).toThrow()
    })

    it('accepts optional extraHeaders as record', () => {
        expect(parseModelConfig('openai-compatible/generic', {
            modelId: 'x',
            baseURL: 'https://api.example.com/v1',
            apiKey: 'sk',
            extraHeaders: { 'X-Custom': 'value' },
        })).toMatchObject({ extraHeaders: { 'X-Custom': 'value' } })
    })
})
