import type { AlibabaDashscopeConnection } from '@lib/providers/registers/alibaba-dashscope-shared'
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { alibabaDashscopeCompatLanguageModel } from '@lib/providers/_internals/alibaba-dashscope-language-model'
import { DASHSCOPE_KIMI_K26_DOC } from '@lib/providers/registers/alibaba-dashscope-shared'
import { parseModelConfig } from '@lib/providers/registry'
import 'server-only'

export function buildAlibabaDashscopeKimiK26LanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as AlibabaDashscopeConnection
    return alibabaDashscopeCompatLanguageModel(config, DASHSCOPE_KIMI_K26_DOC.modelId)
}
