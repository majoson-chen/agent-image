import type { RegisterId, RegisterMetadata } from '@lib/providers/types'
import type { z } from 'zod'
import type { ModelType } from '~/generated/prisma/client'
/**
 * 静态 Provider 注册元数据目录（plan-01，无 DB）。
 */
import { alibabaDashscopeLlmConfigSchema } from '@lib/providers/registers/alibaba-dashscope-llm'
import { braveSearchConfigSchema } from '@lib/providers/registers/brave-search'
import { dashscopeWanImageConfigSchema } from '@lib/providers/registers/dashscope-wan-image'
import { openaiCompatibleGenericConfigSchema } from '@lib/providers/registers/openai-compatible-generic'
import { openaiOfficialConfigSchema } from '@lib/providers/registers/openai-official'
import { volcengineSeedreamConfigSchema } from '@lib/providers/registers/volcengine-seedream'

function asRegisterId(id: string): RegisterId {
    return id as RegisterId
}

const METADATA: RegisterMetadata[] = [
    {
        registerId: asRegisterId('openai/official'),
        modelType: 'LLM',
        title: 'OpenAI 官方',
        sortOrder: 10,
    },
    {
        registerId: asRegisterId('openai-compatible/generic'),
        modelType: 'LLM',
        title: 'OpenAI 兼容（通用）',
        sortOrder: 20,
    },
    {
        registerId: asRegisterId('alibaba/dashscope-llm'),
        modelType: 'LLM',
        title: '阿里云 DashScope LLM',
        sortOrder: 30,
    },
    {
        registerId: asRegisterId('brave/search'),
        modelType: 'SEARCH',
        title: 'Brave Web/Image Search',
        sortOrder: 10,
    },
    {
        registerId: asRegisterId('volcengine/seedream'),
        modelType: 'IMAGE',
        title: '火山方舟 Seedream',
        sortOrder: 10,
    },
    {
        registerId: asRegisterId('dashscope/wan-image'),
        modelType: 'IMAGE',
        title: 'DashScope 万相图像',
        sortOrder: 20,
    },
]

const SCHEMA_BY_ID: Record<string, z.ZodType<unknown>> = {
    'openai/official': openaiOfficialConfigSchema,
    'openai-compatible/generic': openaiCompatibleGenericConfigSchema,
    'alibaba/dashscope-llm': alibabaDashscopeLlmConfigSchema,
    'brave/search': braveSearchConfigSchema,
    'volcengine/seedream': volcengineSeedreamConfigSchema,
    'dashscope/wan-image': dashscopeWanImageConfigSchema,
}

export const REGISTER_IDS: RegisterId[] = METADATA.map(row => row.registerId)

export function parseModelConfig(registerId: string, raw: unknown): unknown {
    const schema = SCHEMA_BY_ID[registerId]
    if (!schema)
        throw new Error(`unknown registerId: ${registerId}`)
    return schema.parse(raw)
}

export function listRegisterMetadata(modelType: ModelType): RegisterMetadata[] {
    return [...METADATA]
        .filter(row => row.modelType === modelType)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(row => ({ ...row }))
}

export function getRegisterMetadata(registerId: string): RegisterMetadata | undefined {
    const row = METADATA.find(m => m.registerId === registerId)
    return row ? { ...row } : undefined
}
