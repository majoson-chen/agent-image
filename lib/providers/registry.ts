/**
 * 静态 Provider 注册元数据目录（plan-01，无 DB）。
 */
import type { RegisterId, RegisterMetadata } from '@lib/providers/types'
import { ModelType } from '~/generated/prisma/client'

function asRegisterId(id: string): RegisterId {
    return id as RegisterId
}

const METADATA: RegisterMetadata[] = [
    {
        registerId: asRegisterId('openai/official'),
        modelType: ModelType.LLM,
        title: 'OpenAI 官方',
        sortOrder: 10,
    },
    {
        registerId: asRegisterId('openai-compatible/generic'),
        modelType: ModelType.LLM,
        title: 'OpenAI 兼容（通用）',
        sortOrder: 20,
    },
    {
        registerId: asRegisterId('alibaba/dashscope-llm'),
        modelType: ModelType.LLM,
        title: '阿里云 DashScope LLM',
        sortOrder: 30,
    },
    {
        registerId: asRegisterId('brave/search'),
        modelType: ModelType.SEARCH,
        title: 'Brave Web/Image Search',
        sortOrder: 10,
    },
    {
        registerId: asRegisterId('volcengine/seedream'),
        modelType: ModelType.IMAGE,
        title: '火山方舟 Seedream',
        sortOrder: 10,
    },
    {
        registerId: asRegisterId('dashscope/wan-image'),
        modelType: ModelType.IMAGE,
        title: 'DashScope 万相图像',
        sortOrder: 20,
    },
]

export const REGISTER_IDS: RegisterId[] = METADATA.map(row => row.registerId)

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
