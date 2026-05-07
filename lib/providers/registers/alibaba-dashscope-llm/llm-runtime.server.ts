import type { AlibabaDashscopeLlmConfig } from '@lib/providers/registers/alibaba-dashscope-llm'

import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { alibabaDashscopeCompatLanguageModel } from '@lib/providers/_internals/alibaba-dashscope-language-model'
import { parseModelConfig } from '@lib/providers/register-config'
import 'server-only'

export function buildAlibabaDashscopeLlmLanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as AlibabaDashscopeLlmConfig
    const { modelId, ...connection } = config
    return alibabaDashscopeCompatLanguageModel(connection, modelId)
}
