/**
 * Register Catalog 行类型（Hook SPEC：llm.languageModel 等）。
 * Kernel 仅依赖本模块与 registry 派发，不识别具体 registerId 列表。
 */
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { RegisterMetadata } from '@lib/providers/types'
import type { CreateImageGenerateToolOptions } from '@lib/tools/registers/image/image-generate-tool-types'
import type { LanguageModel, Tool } from 'ai'
import type { z } from 'zod'
import type { Model } from '~/generated/prisma/client'

export type RegisterCatalogRowBase = RegisterMetadata & {
    schema: z.ZodType<unknown>
}

/** Hook 能力 ID：llm.languageModel */
export type LlmRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'LLM'
    buildLanguageModel: (record: Model) => LanguageModel
    /** Hook 能力 ID：llm.chatProviderOptions — 缺省表示不注入 */
    computeLlmChatProviderOptions?: (record: Model) => ProviderOptions | undefined
}

export type ImageRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'IMAGE'
    /** Hook：image.tool */
    createImageGenerateTool: (opts: CreateImageGenerateToolOptions) => Tool
}

export type SearchRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'SEARCH'
    /** Hook：search.tools — 绑定行的 Model 须 type===SEARCH 且 registerId 与本行一致 */
    buildSearchToolsForModel: (model: Model) => { webSearch: Tool, imageSearch: Tool }
}

export type RegisterCatalogRow = LlmRegisterCatalogRow | ImageRegisterCatalogRow | SearchRegisterCatalogRow
