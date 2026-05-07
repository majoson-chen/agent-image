import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { AlibabaDashscopeLlmConfig } from '@lib/providers/registers/alibaba-dashscope-llm'
import type { AlibabaDashscopeConnection } from '@lib/providers/registers/alibaba-dashscope-shared'
import type { Model } from '~/generated/prisma/client'
import { parseModelConfig } from '@lib/providers/register-config'

const DASHSCOPE_LLM_REGISTER_IDS = new Set<string>([
    'alibaba/dashscope-llm',
    'alibaba/dashscope-kimi-k2-6',
    'alibaba/dashscope-qwen3-6-plus',
])

const DASHSCOPE_THINKING_SKU_IDS = new Set<string>([
    'alibaba/dashscope-kimi-k2-6',
    'alibaba/dashscope-qwen3-6-plus',
])

function parseDashScopeConfig(model: Pick<Model, 'registerId' | 'config'>): AlibabaParsedLlmConfig | null {
    if (!DASHSCOPE_LLM_REGISTER_IDS.has(model.registerId))
        return null
    return parseModelConfig(model.registerId, model.config) as AlibabaParsedLlmConfig
}

type AlibabaParsedLlmConfig = AlibabaDashscopeLlmConfig | AlibabaDashscopeConnection

function dashScopeThinkingCapable(model: Pick<Model, 'registerId'>, config: AlibabaParsedLlmConfig): boolean {
    if (DASHSCOPE_THINKING_SKU_IDS.has(model.registerId))
        return config.capabilities?.supportsThinking !== false

    const gen = config as AlibabaDashscopeLlmConfig
    return gen.capabilities?.supportsThinking === true
}

/** 会话侧「思考默认值」是否与 SKU Register 对齐（SKU 勾选默认开，仅存 false 关掉） */
export function dashScopeThinkingSkuRegisterId(registerId: string): boolean {
    return DASHSCOPE_THINKING_SKU_IDS.has(registerId)
}

/** 会话级 UI：Composer 勾选「思考模式」是否可用 */
export function llmSupportsThinking(meta: Pick<Model, 'registerId' | 'config'>): boolean {
    const cfg = parseDashScopeConfig(meta)
    return cfg !== null && dashScopeThinkingCapable(meta, cfg)
}

/**
 * ToolLoopAgent 注入 Alibaba ProviderOptions。
 * - 通用 DashScope：`supportsThinking` 且会话 `thinkingEnabled===true` 时开启。
 * - Kimi/Qwen SKU：文档要求显式 enable_thinking；会话层 `thinkingEnabled!==false` 视为开（首轮 null 亦为开）。
 */
export function computeLlmChatProviderOptions(
    model: Model,
    params: unknown,
): ProviderOptions | undefined {
    const config = parseDashScopeConfig(model)
    if (!config || !dashScopeThinkingCapable(model, config))
        return undefined

    const p = params as { thinkingEnabled?: boolean | null } | null | undefined
    const budget = config.capabilities?.thinkingBudget
    const parallel = config.parallelToolCalls

    /** 阿里云混合思考 SKU：须在请求体显式带 enable_thinking / thinking_budget（见百炼文档） */
    if (DASHSCOPE_THINKING_SKU_IDS.has(model.registerId)) {
        const enabled = p?.thinkingEnabled !== false

        const out: { enableThinking: boolean, thinkingBudget?: number, parallelToolCalls?: boolean } = {
            enableThinking: enabled,
        }
        if (enabled && budget != null)
            out.thinkingBudget = budget

        if (parallel !== undefined)
            out.parallelToolCalls = parallel

        return { alibaba: out }
    }

    if (model.registerId !== 'alibaba/dashscope-llm')
        return undefined

    if (p?.thinkingEnabled !== true)
        return undefined

    const out: { enableThinking: boolean, thinkingBudget?: number, parallelToolCalls?: boolean } = {
        enableThinking: true,
    }

    if (budget != null)
        out.thinkingBudget = budget

    if (parallel !== undefined)
        out.parallelToolCalls = parallel

    return { alibaba: out }
}
