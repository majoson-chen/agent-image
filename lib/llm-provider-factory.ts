import type { LanguageModel } from 'ai'
import type { Model } from '../generated/prisma/client'
import { createAlibaba } from '@ai-sdk/alibaba'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

/**
 * 根据 Model 记录构建 AI SDK LanguageModel 实例。
 * 仅支持 LLM 类型且 providerType 为 OPENAI / OPENAI_COMPATIBLE / ALIBABA。
 */
export function buildLlmModel(model: Model): LanguageModel {
    if (model.providerType === 'OPENAI') {
        const provider = createOpenAI({ apiKey: model.apiKey })
        return provider(model.name)
    }

    if (model.providerType === 'OPENAI_COMPATIBLE') {
        if (!model.baseURL)
            throw new Error(`Model "${model.name}" (OPENAI_COMPATIBLE) 缺少 baseURL`)

        const provider = createOpenAICompatible({
            name: model.name,
            baseURL: model.baseURL,
            apiKey: model.apiKey,
            headers: (model.extraHeaders as Record<string, string> | null) ?? undefined,
        })
        return provider(model.name)
    }

    if (model.providerType === 'ALIBABA') {
        const provider = createAlibaba({
            apiKey: model.apiKey,
            baseURL: model.baseURL ?? undefined,
            headers: (model.extraHeaders as Record<string, string> | null) ?? undefined,
        })
        return provider(model.name)
    }

    throw new Error(`不支持的 providerType: ${model.providerType}`)
}
