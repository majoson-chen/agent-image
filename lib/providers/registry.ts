import type {
    ImageRegisterCatalogRow,
    LlmRegisterCatalogRow,
    RegisterCatalogRow,
    SearchRegisterCatalogRow,
} from '@lib/providers/register-catalog-types'
import type { RegisterId, RegisterMetadata } from '@lib/providers/types'
/**
 * 静态 Provider 注册元数据目录（plan-01，无 DB）+ LLM 行挂载 `buildLanguageModel`。
 */
import type { CreateImageGenerateToolOptions } from '@lib/tools/registers/image/image-generate-tool-types'
import type { LanguageModel, Tool } from 'ai'
import type { Model, ModelType } from '~/generated/prisma/client'
import { REGISTER_CONFIG_CATALOG } from '@lib/providers/register-config'
import { computeAlibabaDashscopeChatProviderOptions } from '@lib/providers/registers/alibaba-dashscope-chat-options'
import { buildAlibabaDashscopeKimiK26LanguageModel } from '@lib/providers/registers/alibaba-dashscope-kimi-k2-6.llm-runtime'
import { buildAlibabaDashscopeLlmLanguageModel } from '@lib/providers/registers/alibaba-dashscope-llm.llm-runtime'
import { buildAlibabaDashscopeQwen36PlusLanguageModel } from '@lib/providers/registers/alibaba-dashscope-qwen3-6-plus.llm-runtime'
import { buildBraveSearchToolsForModel } from '@lib/providers/registers/brave-search.tools-from-model'
import { buildOpenAiCompatibleGenericLanguageModel } from '@lib/providers/registers/openai-compatible-generic.llm-runtime'
import { buildOpenAiOfficialLanguageModel } from '@lib/providers/registers/openai-official/llm-runtime.server'
import { createDashscopeWanImageGenerateTool } from '@lib/tools/registers/image/dashscope-wan-generate-tool'
import { createVolcengineSeedreamImageGenerateTool } from '@lib/tools/registers/image/volcengine-seedream-generate-tool'

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

/** IMAGE 行挂载 `createImageGenerateTool`（Hook：image.tool） */
const IMAGE_CREATE_IMAGE_GENERATE_TOOL_BY_REGISTER_ID: Record<string, (opts: CreateImageGenerateToolOptions) => Tool> = {
    'volcengine/seedream': createVolcengineSeedreamImageGenerateTool,
    'dashscope/wan-image': createDashscopeWanImageGenerateTool,
}

/** SEARCH 行挂载 `buildSearchToolsForModel`（Hook：search.tools） */
const SEARCH_BUILD_SEARCH_TOOLS_BY_REGISTER_ID: Record<string, (model: Model) => { webSearch: Tool, imageSearch: Tool }> = {
    'brave/search': buildBraveSearchToolsForModel,
}

const REGISTER_CATALOG: readonly RegisterCatalogRow[] = REGISTER_CONFIG_CATALOG.map((row): RegisterCatalogRow => {
    if (row.modelType === 'IMAGE') {
        const createImageGenerateTool = IMAGE_CREATE_IMAGE_GENERATE_TOOL_BY_REGISTER_ID[row.registerId]
        if (!createImageGenerateTool)
            throw new Error(`Missing createImageGenerateTool for IMAGE register ${row.registerId}`)
        return { ...row, createImageGenerateTool }
    }
    if (row.modelType === 'SEARCH') {
        const buildSearchToolsForModel = SEARCH_BUILD_SEARCH_TOOLS_BY_REGISTER_ID[row.registerId]
        if (!buildSearchToolsForModel)
            throw new Error(`Missing buildSearchToolsForModel for SEARCH register ${row.registerId}`)
        return { ...row, buildSearchToolsForModel }
    }
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
        case 'IMAGE': {
            const { schema: _schema, createImageGenerateTool: _createImageGenerateTool, ...meta } = row
            return meta
        }
        case 'SEARCH': {
            const { schema: _schema, buildSearchToolsForModel: _buildSearchToolsForModel, ...meta } = row
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

export function getImageCatalogRowStrict(registerId: string): ImageRegisterCatalogRow {
    const row = REGISTER_CATALOG.find(r => r.registerId === registerId)
    if (!row || row.modelType !== 'IMAGE')
        throw new Error(`unknown IMAGE registerId: ${registerId}`)
    return row
}

export function getSearchCatalogRowStrict(registerId: string): SearchRegisterCatalogRow {
    const row = REGISTER_CATALOG.find(r => r.registerId === registerId)
    if (!row || row.modelType !== 'SEARCH')
        throw new Error(`unknown SEARCH registerId: ${registerId}`)
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
