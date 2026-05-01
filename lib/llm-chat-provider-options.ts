import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { Model } from '~/generated/prisma/client'

/**
 * LLM capabilities：是否允许在会话中启用「思考模式」（阿里云等）。
 * 由设置页写入 `capabilities.supportsThinking`，对话页只读。
 */
export function llmSupportsThinking(capabilities: unknown): boolean {
    if (!capabilities || typeof capabilities !== 'object')
        return false
    return 'supportsThinking' in capabilities
        && (capabilities as { supportsThinking?: boolean }).supportsThinking === true
}

/** 会话级 LLM selection.params → ToolLoopAgent `providerOptions`（当前接线阿里云 enableThinking）。 */
export function computeLlmChatProviderOptions(
    model: Model,
    params: unknown,
): ProviderOptions | undefined {
    if (model.type !== 'LLM' || model.providerType !== 'ALIBABA')
        return undefined

    const p = params as { thinkingEnabled?: boolean } | null | undefined

    if (!llmSupportsThinking(model.capabilities) || !p?.thinkingEnabled)
        return undefined

    return {
        alibaba: {
            enableThinking: true,
        },
    }
}
