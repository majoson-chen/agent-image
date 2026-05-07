/**
 * Prisma Model → LanguageModel（SPEC G4 对外入口）。
 */
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { getLlmCatalogRowStrict } from '@lib/providers/registry'
import 'server-only'

export function buildLlmLanguageModel(record: Model): LanguageModel {
    if (record.type !== 'LLM')
        throw new Error(`期望 LLM 模型，实际 type=${record.type}`)
    return getLlmCatalogRowStrict(record.registerId).buildLanguageModel(record)
}
