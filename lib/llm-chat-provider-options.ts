/**
 * LLM 会话层 ProviderOptions：从 Catalog 行 `computeLlmChatProviderOptions` 派发（Kernel 无厂商名单）。
 */
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { Model } from '~/generated/prisma/client'
import { getLlmCatalogRowStrict } from '@lib/providers/registry'

export function computeLlmChatProviderOptions(model: Model): ProviderOptions | undefined {
    const row = getLlmCatalogRowStrict(model.registerId)
    return row.computeLlmChatProviderOptions?.(model)
}

export {
    dashScopeThinkingEnabledFromConfig,
    dashScopeThinkingSkuRegisterId,
    llmSupportsThinking,
} from '@lib/providers/registers/alibaba-dashscope-chat-options'
