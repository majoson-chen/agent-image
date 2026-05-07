import type { LlmRegisterCatalogRow, RegisterCatalogRow } from '@lib/providers/register-catalog-types'
import type { RegisterId, RegisterMetadata } from '@lib/providers/types'
/**
 * 静态 Provider 注册元数据目录（plan-01，无 DB）+ LLM 行挂载 `buildLanguageModel`。
 */
import type { LanguageModel } from 'ai'
import type { Model, ModelType } from '~/generated/prisma/client'
import { REGISTER_CONFIG_CATALOG } from '@lib/providers/register-config'
import { computeAlibabaDashscopeChatProviderOptions } from '@lib/providers/registers/alibaba-dashscope-chat-options'
import { buildAlibabaDashscopeKimiK26LanguageModel } from '@lib/providers/registers/alibaba-dashscope-kimi-k2-6.llm-runtime'
import { buildAlibabaDashscopeLlmLanguageModel } from '@lib/providers/registers/alibaba-dashscope-llm.llm-runtime'
import { buildAlibabaDashscopeQwen36PlusLanguageModel } from '@lib/providers/registers/alibaba-dashscope-qwen3-6-plus.llm-runtime'
import { buildOpenAiCompatibleGenericLanguageModel } from '@lib/providers/registers/openai-compatible-generic.llm-runtime'
import { buildOpenAiOfficialLanguageModel } from '@lib/providers/registers/openai-official.llm-runtime'

export type {
    ImageRegisterCatalogRow,
    LlmRegisterCatalogRow,
    RegisterCatalogRow,
    SearchRegisterCatalogRow,
} from './register-catalog-types'

export { parseModelConfig } from './register-config'

const LLM_BUILD_LANGUAGE_MODEL_BY_REGISTER_ID: Record<string, (record: Model) => LanguageModel> = {
    'openai/official': buildOpenAiOfficialLanguageModel,
    'openai-compatible/generic': buildOpenAiCompatibleGenericLanguageModel,
    'alibaba/dashscope-kimi-k2-6': buildAlibabaDashscopeKimiK26LanguageModel,
    'alibaba/dashscope-qwen3-6-plus': buildAlibabaDashscopeQwen36PlusLanguageModel,
    'alibaba/dashscope-llm': buildAlibabaDashscopeLlmLanguageModel,
}

/** Catalog 组装：哪些 LLM 行挂载 Alibaba DashScope `computeLlmChatProviderOptions`（与 `alibaba-dashscope-chat-options` 内解析列表一致） */
const LLM_COMPUTE_CHAT_PROVIDER_OPTIONS_REGISTER_IDS = new Set<string>([
    'alibaba/dashscope-llm',
    'alibaba/dashscope-kimi-k2-6',
    'alibaba/dashscope-qwen3-6-plus',
])

const REGISTER_CATALOG: readonly RegisterCatalogRow[] = REGISTER_CONFIG_CATALOG.map((row): RegisterCatalogRow => {
    if (row.modelType !== 'LLM')
        return { ...row }
    const buildLanguageModel = LLM_BUILD_LANGUAGE_MODEL_BY_REGISTER_ID[row.registerId]
    if (!buildLanguageModel)
        throw new Error(`Missing buildLanguageModel for LLM register ${row.registerId}`)
    const computeLlmChatProviderOptions = LLM_COMPUTE_CHAT_PROVIDER_OPTIONS_REGISTER_IDS.has(row.registerId)
        ? computeAlibabaDashscopeChatProviderOptions
        : undefined
    return { ...row, buildLanguageModel, computeLlmChatProviderOptions }
})

export function getCatalogRow(registerId: string): RegisterCatalogRow | undefined {
    return REGISTER_CATALOG.find(r => r.registerId === registerId)
}

function rowToMetadata(row: RegisterCatalogRow): RegisterMetadata {
    switch (row.modelType) {
        case 'LLM': {
            const {
                schema: _schema,
                buildLanguageModel: _buildLanguageModel,
                computeLlmChatProviderOptions: _computeLlmChatProviderOptions,
                ...meta
            } = row
            return meta
        }
        case 'IMAGE':
        case 'SEARCH': {
            const { schema: _schema, ...meta } = row
            return meta
        }
    }
}

export const REGISTER_IDS: RegisterId[] = REGISTER_CATALOG.map(row => row.registerId)

export function getLlmCatalogRowStrict(registerId: string): LlmRegisterCatalogRow {
    const row = REGISTER_CATALOG.find(r => r.registerId === registerId)
    if (!row || row.modelType !== 'LLM')
        throw new Error(`unknown LLM registerId: ${registerId}`)
    return row
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
