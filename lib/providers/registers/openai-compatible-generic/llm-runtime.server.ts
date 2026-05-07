import 'server-only'

import type { OpenaiCompatibleGenericConfig } from '@lib/providers/registers/openai-compatible-generic'
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { parseModelConfig } from '@lib/providers/register-config'

export function buildOpenAiCompatibleGenericLanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as OpenaiCompatibleGenericConfig
    return createOpenAICompatible({
        name: record.name,
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        headers: config.extraHeaders,
    })(config.modelId)
}
