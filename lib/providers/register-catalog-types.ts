/**
 * Register Catalog 行类型（Hook SPEC：llm.languageModel 等）。
 * Kernel 仅依赖本模块与 registry 派发，不识别具体 registerId 列表。
 */
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { RegisterMetadata } from '@lib/providers/types'
import type { LanguageModel } from 'ai'
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
}

export type SearchRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'SEARCH'
}

export type RegisterCatalogRow = LlmRegisterCatalogRow | ImageRegisterCatalogRow | SearchRegisterCatalogRow
