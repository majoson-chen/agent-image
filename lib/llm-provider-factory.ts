import type { AlibabaDashscopeLlmConfig } from '@lib/providers/registers/alibaba-dashscope-llm'
import type { OpenaiCompatibleGenericConfig } from '@lib/providers/registers/openai-compatible-generic'
import type { OpenaiOfficialConfig } from '@lib/providers/registers/openai-official'
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { createAlibaba } from '@ai-sdk/alibaba'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { parseModelConfig } from '@lib/providers/registry'

/**
 * 根据 Model 记录构建 AI SDK LanguageModel 实例。
 * DB name 只是用户标签；实际请求模型名来自 register config.modelId。
 */
export function buildLlmModel(model: Model): LanguageModel {
    if (model.type !== 'LLM')
        throw new Error(`不是 LLM 模型: ${model.id}`)

    if (model.registerId === 'openai/official') {
        const config = parseModelConfig(model.registerId, model.config) as OpenaiOfficialConfig
        const provider = createOpenAI({ apiKey: config.apiKey })
        return provider(config.modelId)
    }

    if (model.registerId === 'openai-compatible/generic') {
        const config = parseModelConfig(model.registerId, model.config) as OpenaiCompatibleGenericConfig
        const provider = createOpenAICompatible({
            name: model.name,
            baseURL: config.baseURL,
            apiKey: config.apiKey,
            headers: config.extraHeaders,
        })
        return provider(config.modelId)
    }

    if (model.registerId === 'alibaba/dashscope-llm') {
        const config = parseModelConfig(model.registerId, model.config) as AlibabaDashscopeLlmConfig
        const provider = createAlibaba({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            headers: config.extraHeaders,
        })
        return provider(config.modelId)
    }

    throw new Error(`不支持的 LLM registerId: ${model.registerId}`)
}
