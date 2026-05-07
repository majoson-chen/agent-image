/**
 * Register Catalog 行类型（Hook SPEC：llm.languageModel 等）。
 * Kernel 仅依赖本模块与 registry 派发，不识别具体 registerId 列表。
 */
import type { LanguageModel } from 'ai'
import type { RegisterMetadata } from '@lib/providers/types'
import type { Model } from '~/generated/prisma/client'
import type { z } from 'zod'

export type RegisterCatalogRowBase = RegisterMetadata & {
    schema: z.ZodType<unknown>
}

/** Hook 能力 ID：llm.languageModel */
export type LlmRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'LLM'
    buildLanguageModel: (record: Model) => LanguageModel
}

export type ImageRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'IMAGE'
}

export type SearchRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'SEARCH'
}

export type RegisterCatalogRow =
    | LlmRegisterCatalogRow
    | ImageRegisterCatalogRow
    | SearchRegisterCatalogRow
