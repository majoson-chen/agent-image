import type { Model } from '~/generated/prisma/client'
import { computeLlmChatProviderOptions, llmSupportsThinking } from '@lib/llm-chat-provider-options'

import { describe, expect, it } from 'vitest'

function alibabaLlm(over: Partial<Model> & Pick<Model, 'capabilities'>): Model {
    return {
        id: 'm-alibaba',
        type: 'LLM',
        name: 'qwen',
        providerType: 'ALIBABA',
        baseURL: null,
        apiKey: 'k',
        contextWindow: 128000,
        extraHeaders: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...over,
    } as Model
}

describe('llmSupportsThinking', () => {
    it('returns false for null or non-object', () => {
        expect(llmSupportsThinking(null)).toBe(false)
        expect(llmSupportsThinking(undefined)).toBe(false)
        expect(llmSupportsThinking('x')).toBe(false)
    })

    it('returns true only when supportsThinking is true', () => {
        expect(llmSupportsThinking({ supportsThinking: true })).toBe(true)
        expect(llmSupportsThinking({ supportsThinking: false })).toBe(false)
    })
})

describe('computeLlmChatProviderOptions', () => {
    it('returns undefined when not ALIBABA LLM', () => {
        const m = alibabaLlm({ capabilities: { supportsThinking: true } })
        const openai = { ...m, providerType: 'OPENAI' as const }
        expect(computeLlmChatProviderOptions(openai as Model, { thinkingEnabled: true })).toBeUndefined()
    })

    it('returns alibaba.enableThinking when capability and session params allow', () => {
        const m = alibabaLlm({ capabilities: { supportsThinking: true } })
        expect(computeLlmChatProviderOptions(m, { thinkingEnabled: true })).toEqual({
            alibaba: { enableThinking: true },
        })
    })

    it('returns undefined when model does not support thinking', () => {
        const m = alibabaLlm({ capabilities: {} })
        expect(computeLlmChatProviderOptions(m, { thinkingEnabled: true })).toBeUndefined()
    })

    it('returns undefined when session has thinking off', () => {
        const m = alibabaLlm({ capabilities: { supportsThinking: true } })
        expect(computeLlmChatProviderOptions(m, { thinkingEnabled: false })).toBeUndefined()
        expect(computeLlmChatProviderOptions(m, null)).toBeUndefined()
    })
})
