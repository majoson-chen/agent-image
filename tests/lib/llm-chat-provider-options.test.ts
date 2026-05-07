import type { Model } from '~/generated/prisma/client'
import { computeLlmChatProviderOptions, llmSupportsThinking } from '@lib/llm-chat-provider-options'

import { describe, expect, it } from 'vitest'

function alibabaLlm(over: Partial<Model> = {}): Model {
    return {
        id: 'm-alibaba',
        type: 'LLM',
        name: 'qwen',
        registerId: 'alibaba/dashscope-llm',
        config: { modelId: 'qwen-plus', apiKey: 'k' },
        createdAt: new Date(),
        updatedAt: new Date(),
        ...over,
    }
}

describe('llmSupportsThinking', () => {
    it('returns false for null or non-object', () => {
        expect(llmSupportsThinking(null)).toBe(false)
        expect(llmSupportsThinking(undefined)).toBe(false)
        expect(llmSupportsThinking('x')).toBe(false)
    })

    it('returns true only when supportsThinking is true', () => {
        expect(llmSupportsThinking({ capabilities: { supportsThinking: true } })).toBe(true)
        expect(llmSupportsThinking({ capabilities: { supportsThinking: false } })).toBe(false)
    })
})

describe('computeLlmChatProviderOptions', () => {
    it('returns undefined when not ALIBABA LLM', () => {
        const openai = {
            ...alibabaLlm(),
            registerId: 'openai/official',
            config: { modelId: 'gpt-4o', apiKey: 'k' },
        }
        expect(computeLlmChatProviderOptions(openai, { thinkingEnabled: true })).toBeUndefined()
    })

    it('returns alibaba.enableThinking when capability and session params allow', () => {
        const m = alibabaLlm({ config: { modelId: 'qwen-plus', apiKey: 'k', capabilities: { supportsThinking: true } } })
        expect(computeLlmChatProviderOptions(m, { thinkingEnabled: true })).toEqual({
            alibaba: { enableThinking: true },
        })
    })

    it('returns undefined when model does not support thinking', () => {
        const m = alibabaLlm()
        expect(computeLlmChatProviderOptions(m, { thinkingEnabled: true })).toBeUndefined()
    })

    it('returns undefined when session has thinking off', () => {
        const m = alibabaLlm({ config: { modelId: 'qwen-plus', apiKey: 'k', capabilities: { supportsThinking: true } } })
        expect(computeLlmChatProviderOptions(m, { thinkingEnabled: false })).toBeUndefined()
        expect(computeLlmChatProviderOptions(m, null)).toBeUndefined()
    })
})
