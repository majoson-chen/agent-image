/**
 * Alibaba DashScope LLM：会话层 ProviderOptions（thinking / parallelToolCalls）与设置页「思考」可见性辅助。
 * 由 Catalog 行挂载 `computeAlibabaDashscopeChatProviderOptions`；Kernel 经 `lib/llm-chat-provider-options` 转发。
 */
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { AlibabaDashscopeLlmConfig } from '@lib/providers/registers/alibaba-dashscope-llm'
import type { AlibabaDashscopeConnection } from '@lib/providers/registers/_shared/alibaba-dashscope-shared'
import type { Model } from '~/generated/prisma/client'
import { parseModelConfig } from '@lib/providers/register-config'

/** 使用 Alibaba DashScope LLM config 解析路径的 registerId（与 Catalog 中挂载 chat options 钩子的行一致） */
const ALIBABA_DASHSCOPE_LLM_REGISTER_IDS: readonly string[] = [
    'alibaba/dashscope-llm',
    'alibaba/dashscope-kimi-k2-6',
    'alibaba/dashscope-qwen3-6-plus',
]

const DASHSCOPE_THINKING_SKU_REGISTER_IDS: readonly string[] = [
    'alibaba/dashscope-kimi-k2-6',
    'alibaba/dashscope-qwen3-6-plus',
]

function parseDashScopeConfig(model: Pick<Model, 'registerId' | 'config'>): AlibabaParsedLlmConfig | null {
    if (!ALIBABA_DASHSCOPE_LLM_REGISTER_IDS.includes(model.registerId))
        return null
    return parseModelConfig(model.registerId, model.config) as AlibabaParsedLlmConfig
}

type AlibabaParsedLlmConfig = AlibabaDashscopeLlmConfig | AlibabaDashscopeConnection

/** 是否在 API 请求中挂载 thinking 相关 Alibaba ProviderOptions（由设置里的 config.capabilities 决定） */
export function dashScopeThinkingEnabledFromConfig(meta: Pick<Model, 'registerId'>, config: AlibabaParsedLlmConfig): boolean {
    if (DASHSCOPE_THINKING_SKU_REGISTER_IDS.includes(meta.registerId))
        return config.capabilities?.supportsThinking !== false

    const gen = config as AlibabaDashscopeLlmConfig
    return gen.capabilities?.supportsThinking === true
}

export function dashScopeThinkingSkuRegisterId(registerId: string): boolean {
    return DASHSCOPE_THINKING_SKU_REGISTER_IDS.includes(registerId)
}

/**
 *「模型是否能在 UI/设置里挂上思考配置」语义（SKU 默认可配；通用须显式 supportsThinking）。
 * 会话内不再切换；实际发请求仍以 {@link dashScopeThinkingEnabledFromConfig} 为准。
 */
export function llmSupportsThinking(meta: Pick<Model, 'registerId' | 'config'>): boolean {
    const cfg = parseDashScopeConfig(meta)
    return cfg !== null && dashScopeThinkingEnabledFromConfig(meta, cfg)
}

/**
 * 按模型配置拼装 Alibaba ProviderOptions（`enableThinking` / `thinkingBudget` 等）。
 * 是否与百炼对齐见设置页与各 Register schema；不传会话 params。
 *
 * @see https://www.npmjs.com/package/@ai-sdk/alibaba README 「Thinking Mode Example」
 */
export function computeAlibabaDashscopeChatProviderOptions(model: Model): ProviderOptions | undefined {
    const config = parseDashScopeConfig(model)
    if (!config || !dashScopeThinkingEnabledFromConfig(model, config))
        return undefined

    const budget = config.capabilities?.thinkingBudget
    const parallel = config.parallelToolCalls

    const out: { enableThinking: boolean, thinkingBudget?: number, parallelToolCalls?: boolean } = {
        enableThinking: true,
    }

    if (budget != null)
        out.thinkingBudget = budget

    if (parallel !== undefined)
        out.parallelToolCalls = parallel

    return { alibaba: out }
}
