/**
 * LLM / IMAGE / SEARCH 各 Register 的 Zod schema 目录与 `parseModelConfig`。
 * 与 `registry.ts` 解耦，避免 `*.llm-runtime.ts` 与 Catalog 派发的循环依赖。
 */
import type { RegisterId, RegisterMetadata } from '@lib/providers/types'
import type { z } from 'zod'
import { alibabaDashscopeKimiK26ConfigSchema } from '@lib/providers/registers/alibaba-dashscope-kimi-k2-6'
import { alibabaDashscopeLlmConfigSchema } from '@lib/providers/registers/alibaba-dashscope-llm'
import { alibabaDashscopeQwen36PlusConfigSchema } from '@lib/providers/registers/alibaba-dashscope-qwen3-6-plus'
import { braveSearchConfigSchema } from '@lib/providers/registers/brave-search'
import { dashscopeWanImageConfigSchema } from '@lib/providers/registers/dashscope-wan-image'
import { openaiCompatibleGenericConfigSchema } from '@lib/providers/registers/openai-compatible-generic'
import { openaiOfficialConfigSchema } from '@lib/providers/registers/openai-official'
import { volcengineSeedreamConfigSchema } from '@lib/providers/registers/volcengine-seedream'

function asRegisterId(id: string): RegisterId {
    return id as RegisterId
}

/** 单条目录：元数据 + 解析 schema（无运行时 `LanguageModel` 构造）。 */
export type RegisterConfigCatalogRow = RegisterMetadata & { schema: z.ZodType<unknown> }

export const REGISTER_CONFIG_CATALOG: readonly RegisterConfigCatalogRow[] = [
    {
        registerId: asRegisterId('openai/official'),
        modelType: 'LLM',
        title: 'OpenAI 官方',
        sortOrder: 10,
        schema: openaiOfficialConfigSchema,
    },
    {
        registerId: asRegisterId('openai-compatible/generic'),
        modelType: 'LLM',
        title: 'OpenAI 兼容（通用）',
        sortOrder: 20,
        schema: openaiCompatibleGenericConfigSchema,
    },
    {
        registerId: asRegisterId('alibaba/dashscope-kimi-k2-6'),
        modelType: 'LLM',
        title: '阿里云百炼 Kimi K2.6',
        description: '锁定 model=kimi-k2.6，支持多模态与思考开关（会话内勾选）',
        sortOrder: 28,
        schema: alibabaDashscopeKimiK26ConfigSchema,
    },
    {
        registerId: asRegisterId('alibaba/dashscope-qwen3-6-plus'),
        modelType: 'LLM',
        title: '阿里云百炼 Qwen 3.6 Plus',
        description: '锁定 model=qwen3.6-plus，支持混合思考模式',
        sortOrder: 29,
        schema: alibabaDashscopeQwen36PlusConfigSchema,
    },
    {
        registerId: asRegisterId('alibaba/dashscope-llm'),
        modelType: 'LLM',
        title: '阿里云 DashScope LLM（自填模型）',
        sortOrder: 30,
        schema: alibabaDashscopeLlmConfigSchema,
    },
    {
        registerId: asRegisterId('brave/search'),
        modelType: 'SEARCH',
        title: 'Brave Web/Image Search',
        sortOrder: 10,
        schema: braveSearchConfigSchema,
    },
    {
        registerId: asRegisterId('volcengine/seedream'),
        modelType: 'IMAGE',
        title: '火山方舟 Seedream',
        sortOrder: 10,
        imagePresetKind: 'seedream',
        schema: volcengineSeedreamConfigSchema,
    },
    {
        registerId: asRegisterId('dashscope/wan-image'),
        modelType: 'IMAGE',
        title: 'DashScope 万相图像',
        sortOrder: 20,
        imagePresetKind: 'wan',
        schema: dashscopeWanImageConfigSchema,
    },
]

export function parseModelConfig(registerId: string, raw: unknown): unknown {
    const row = REGISTER_CONFIG_CATALOG.find(r => r.registerId === registerId)
    if (!row)
        throw new Error(`unknown registerId: ${registerId}`)
    return row.schema.parse(raw)
}
