/**
 * 静态 Provider 注册元数据目录（plan-01，无 DB）。
 */
import type { RegisterId, RegisterMetadata } from '@lib/providers/types'
import { alibabaDashscopeLlmConfigSchema } from '@lib/providers/registers/alibaba-dashscope-llm'
import { braveSearchConfigSchema } from '@lib/providers/registers/brave-search'
import { dashscopeWanImageConfigSchema } from '@lib/providers/registers/dashscope-wan-image'
import { openaiCompatibleGenericConfigSchema } from '@lib/providers/registers/openai-compatible-generic'
import { openaiOfficialConfigSchema } from '@lib/providers/registers/openai-official'
import { volcengineSeedreamConfigSchema } from '@lib/providers/registers/volcengine-seedream'
import type { z } from 'zod'
import type { ModelType } from '~/generated/prisma/client'

function asRegisterId(id: string): RegisterId {
    return id as RegisterId
}

/** 单条目录：元数据 + 解析 schema，避免 registerId 与 schema 映射分叉。 */
type RegisterCatalogRow = RegisterMetadata & { schema: z.ZodType<unknown> }

const REGISTER_CATALOG: readonly RegisterCatalogRow[] = [
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
        registerId: asRegisterId('alibaba/dashscope-llm'),
        modelType: 'LLM',
        title: '阿里云 DashScope LLM',
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
        schema: volcengineSeedreamConfigSchema,
    },
    {
        registerId: asRegisterId('dashscope/wan-image'),
        modelType: 'IMAGE',
        title: 'DashScope 万相图像',
        sortOrder: 20,
        schema: dashscopeWanImageConfigSchema,
    },
]

function rowToMetadata({ schema: _schema, ...meta }: RegisterCatalogRow): RegisterMetadata {
    return meta
}

export const REGISTER_IDS: RegisterId[] = REGISTER_CATALOG.map(row => row.registerId)

export function parseModelConfig(registerId: string, raw: unknown): unknown {
    const row = REGISTER_CATALOG.find(r => r.registerId === registerId)
    if (!row)
        throw new Error(`unknown registerId: ${registerId}`)
    return row.schema.parse(raw)
}

export function listRegisterMetadata(modelType: ModelType): RegisterMetadata[] {
    return [...REGISTER_CATALOG]
        .filter(row => row.modelType === modelType)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(row => ({ ...rowToMetadata(row) }))
}

export function getRegisterMetadata(registerId: string): RegisterMetadata | undefined {
    const row = REGISTER_CATALOG.find(m => m.registerId === registerId)
    return row ? { ...rowToMetadata(row) } : undefined
}
