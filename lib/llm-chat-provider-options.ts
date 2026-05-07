/**
 * LLM 会话层 ProviderOptions：Alibaba DashScope 逻辑见 `alibaba-dashscope-chat-options`（Catalog 挂载见后续 registry 变更）。
 */
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { Model } from '~/generated/prisma/client'
import { computeAlibabaDashscopeChatProviderOptions } from '@lib/providers/registers/alibaba-dashscope-chat-options'

export function computeLlmChatProviderOptions(model: Model): ProviderOptions | undefined {
    return computeAlibabaDashscopeChatProviderOptions(model)
}

export {
    dashScopeThinkingEnabledFromConfig,
    dashScopeThinkingSkuRegisterId,
    llmSupportsThinking,
} from '@lib/providers/registers/alibaba-dashscope-chat-options'
