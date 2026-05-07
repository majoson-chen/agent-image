import type { AlibabaDashscopeLlmConfig } from '@lib/providers/registers/alibaba-dashscope-llm'
import type { AlibabaDashscopeConnection } from '@lib/providers/registers/_shared/alibaba-dashscope-shared'
import type { Model } from '~/generated/prisma/client'
import {
    computeLlmChatProviderOptions,
    dashScopeThinkingEnabledFromConfig,
    dashScopeThinkingSkuRegisterId,
    llmSupportsThinking,
} from '@lib/llm-chat-provider-options'
import { parseModelConfig } from '@lib/providers/register-config'

import { describe, expect, it } from 'vitest'

type AlibabaDashParsed = AlibabaDashscopeLlmConfig | AlibabaDashscopeConnection

function parseDash(cfg: Pick<Model, 'registerId' | 'config'>): AlibabaDashParsed {
    return parseModelConfig(cfg.registerId, cfg.config) as AlibabaDashParsed
}

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

function kimiSku(over: Partial<Model> = {}): Model {
    return {
        ...alibabaLlm({
            registerId: 'alibaba/dashscope-kimi-k2-6',
            name: 'kimi sku',
            config: { apiKey: 'sk' },
        }),
        ...over,
    }
}

describe('dashScopeThinkingSkuRegisterId', () => {
    it('flags preset sku registers', () => {
        expect(dashScopeThinkingSkuRegisterId('alibaba/dashscope-kimi-k2-6')).toBe(true)
        expect(dashScopeThinkingSkuRegisterId('alibaba/dashscope-qwen3-6-plus')).toBe(true)
        expect(dashScopeThinkingSkuRegisterId('alibaba/dashscope-llm')).toBe(false)
    })
})

describe('dashScopeThinkingEnabledFromConfig', () => {
    it('SKU default on unless supportsThinking false', () => {
        const m = kimiSku()
        expect(dashScopeThinkingEnabledFromConfig(m, parseDash(m))).toBe(true)

        const mOff = kimiSku({
            config: { apiKey: 'k', capabilities: { supportsThinking: false } },
        })
        expect(dashScopeThinkingEnabledFromConfig(mOff, parseDash(mOff))).toBe(false)
    })

    it('generic only when capabilities.supportsThinking true', () => {
        const gen = alibabaLlm()
        expect(
            dashScopeThinkingEnabledFromConfig(
                gen,
                parseDash(gen),
            ),
        ).toBe(false)

        const genOn = alibabaLlm({
            config: { modelId: 'q', apiKey: 'k', capabilities: { supportsThinking: true } },
        })
        expect(
            dashScopeThinkingEnabledFromConfig(
                genOn,
                parseDash(genOn),
            ),
        ).toBe(true)
    })
})

describe('llmSupportsThinking', () => {
    it('returns false when config cannot parse DashScope fragment', () => {
        expect(llmSupportsThinking({
            registerId: 'openai/official',
            config: {},
        })).toBe(false)
    })

    it('SKU defaults to thinking-capable unless capabilities override', () => {
        expect(llmSupportsThinking(kimiSku())).toBe(true)
        expect(llmSupportsThinking(kimiSku({ config: { apiKey: 'x', capabilities: { supportsThinking: false } } }))).toBe(
            false,
        )
    })

    it('generic DashScope only when explicitly marked', () => {
        expect(llmSupportsThinking(alibabaLlm())).toBe(false)
        expect(llmSupportsThinking(alibabaLlm({
            config: {
                modelId: 'q',
                apiKey: 'k',
                capabilities: { supportsThinking: true },
            },
        }))).toBe(true)
    })
})

describe('computeLlmChatProviderOptions', () => {
    it('returns undefined when not DashScope Alibaba LLM', () => {
        const openai = {
            ...alibabaLlm(),
            registerId: 'openai/official',
            config: { modelId: 'gpt-4o', apiKey: 'k' },
        }
        expect(computeLlmChatProviderOptions(openai)).toBeUndefined()
    })

    it('generic DashScope sends enableThinking+budget when configured on', () => {
        const m = alibabaLlm({
            config: {
                modelId: 'qwen-plus',
                apiKey: 'k',
                capabilities: { supportsThinking: true, thinkingBudget: 300 },
            },
        })
        expect(computeLlmChatProviderOptions(m)).toEqual({
            alibaba: {
                enableThinking: true,
                thinkingBudget: 300,
            },
        })
    })

    it('generic DashScope omit when supportsThinking absent', () => {
        expect(computeLlmChatProviderOptions(alibabaLlm())).toBeUndefined()
    })

    it('SKU sends enableThinking from config gate (default on)', () => {
        expect(computeLlmChatProviderOptions(kimiSku())).toEqual({
            alibaba: { enableThinking: true },
        })
    })

    it('SKU omits Alibaba options when capabilities.supportsThinking false', () => {
        expect(
            computeLlmChatProviderOptions(kimiSku({
                config: { apiKey: 'k', capabilities: { supportsThinking: false } },
            })),
        ).toBeUndefined()
    })

    it('SKU merges budget when thinking on', () => {
        expect(computeLlmChatProviderOptions(
            kimiSku({ config: { apiKey: 'k', capabilities: { thinkingBudget: 400 } } }),
        )).toEqual({
            alibaba: {
                enableThinking: true,
                thinkingBudget: 400,
            },
        })
    })

    it('SKU omits budget in options when capability off (no ProviderOptions)', () => {
        const m = kimiSku({
            config: {
                apiKey: 'k',
                capabilities: { supportsThinking: false, thinkingBudget: 8192 },
            },
        })
        expect(computeLlmChatProviderOptions(m)).toBeUndefined()
    })

    it('passes parallelToolCalls from config when thinking on', () => {
        const m = kimiSku({
            config: {
                apiKey: 'k',
                parallelToolCalls: false,
                capabilities: { thinkingBudget: 50 },
            },
        })
        expect(computeLlmChatProviderOptions(m)).toEqual({
            alibaba: {
                enableThinking: true,
                thinkingBudget: 50,
                parallelToolCalls: false,
            },
        })
    })
})
