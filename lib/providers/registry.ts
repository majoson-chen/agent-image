import type { RegisterId, RegisterMetadata } from '@lib/providers/types'
/**
 * 静态 Provider 注册元数据目录（plan-01，无 DB）+ LLM 行挂载 `buildLanguageModel`。
 */
import type { LanguageModel } from 'ai'
import type { z } from 'zod'
import type { Model, ModelType } from '~/generated/prisma/client'
import { REGISTER_CONFIG_CATALOG } from '@lib/providers/register-config'
import { buildAlibabaDashscopeKimiK26LanguageModel } from '@lib/providers/registers/alibaba-dashscope-kimi-k2-6.llm-runtime'
import { buildAlibabaDashscopeLlmLanguageModel } from '@lib/providers/registers/alibaba-dashscope-llm.llm-runtime'
import { buildAlibabaDashscopeQwen36PlusLanguageModel } from '@lib/providers/registers/alibaba-dashscope-qwen3-6-plus.llm-runtime'
import { buildOpenAiCompatibleGenericLanguageModel } from '@lib/providers/registers/openai-compatible-generic.llm-runtime'
import { buildOpenAiOfficialLanguageModel } from '@lib/providers/registers/openai-official.llm-runtime'

export { parseModelConfig } from './register-config'

/** 目录行：`RegisterMetadata` + schema + （仅 LLM）`buildLanguageModel`。 */
export type RegisterCatalogRow = RegisterMetadata & {
    schema: z.ZodType<unknown>
    buildLanguageModel?: (record: Model) => LanguageModel
}

const LLM_BUILD_LANGUAGE_MODEL_BY_REGISTER_ID: Record<string, (record: Model) => LanguageModel> = {
    'openai/official': buildOpenAiOfficialLanguageModel,
    'openai-compatible/generic': buildOpenAiCompatibleGenericLanguageModel,
    'alibaba/dashscope-kimi-k2-6': buildAlibabaDashscopeKimiK26LanguageModel,
    'alibaba/dashscope-qwen3-6-plus': buildAlibabaDashscopeQwen36PlusLanguageModel,
    'alibaba/dashscope-llm': buildAlibabaDashscopeLlmLanguageModel,
}

const REGISTER_CATALOG: readonly RegisterCatalogRow[] = REGISTER_CONFIG_CATALOG.map((row): RegisterCatalogRow => {
    if (row.modelType !== 'LLM')
        return { ...row }
    const buildLanguageModel = LLM_BUILD_LANGUAGE_MODEL_BY_REGISTER_ID[row.registerId]
    if (!buildLanguageModel)
        throw new Error(`Missing buildLanguageModel for LLM register ${row.registerId}`)
    return { ...row, buildLanguageModel }
})

function rowToMetadata({ schema: _schema, buildLanguageModel: _buildLanguageModel, ...meta }: RegisterCatalogRow): RegisterMetadata {
    return meta
}

export const REGISTER_IDS: RegisterId[] = REGISTER_CATALOG.map(row => row.registerId)

export function getLlmCatalogRowStrict(registerId: string) {
    const row = REGISTER_CATALOG.find(r => r.registerId === registerId)
    if (!row || row.modelType !== 'LLM')
        throw new Error(`unknown LLM registerId: ${registerId}`)
    const b = row.buildLanguageModel
    if (!b)
        throw new Error(`Register ${registerId} 缺少 buildLanguageModel`)
    return { ...row, buildLanguageModel: b }
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
