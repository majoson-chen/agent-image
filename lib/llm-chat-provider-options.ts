import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { AlibabaDashscopeLlmConfig } from '@lib/providers/registers/alibaba-dashscope-llm'
import type { Model } from '~/generated/prisma/client'
import { parseModelConfig } from '@lib/providers/registry'

/**
 * LLM capabilities：是否允许在会话中启用「思考模式」（阿里云等）。
 * 由设置页写入 `config.capabilities.supportsThinking`，对话页只读。
 */
export function llmSupportsThinking(config: unknown): boolean {
    if (!config || typeof config !== 'object')
        return false
    const capabilities = (config as { capabilities?: { supportsThinking?: boolean } }).capabilities
    return capabilities?.supportsThinking === true
}

/** 会话级 LLM selection.params → ToolLoopAgent `providerOptions`（当前接线阿里云 enableThinking）。 */
export function computeLlmChatProviderOptions(
    model: Model,
    params: unknown,
): ProviderOptions | undefined {
    if (model.type !== 'LLM' || model.registerId !== 'alibaba/dashscope-llm')
        return undefined

    const p = params as { thinkingEnabled?: boolean } | null | undefined
    const config = parseModelConfig(model.registerId, model.config) as AlibabaDashscopeLlmConfig

    if (!llmSupportsThinking(config) || !p?.thinkingEnabled)
        return undefined

    return {
        alibaba: {
            enableThinking: true,
        },
    }
}
