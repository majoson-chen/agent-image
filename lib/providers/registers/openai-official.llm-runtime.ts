import type { OpenaiOfficialConfig } from '@lib/providers/registers/openai-official'
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { createOpenAI } from '@ai-sdk/openai'
import { parseModelConfig } from '@lib/providers/register-config'
import 'server-only'

export function buildOpenAiOfficialLanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as OpenaiOfficialConfig
    return createOpenAI({ apiKey: config.apiKey })(config.modelId)
}
