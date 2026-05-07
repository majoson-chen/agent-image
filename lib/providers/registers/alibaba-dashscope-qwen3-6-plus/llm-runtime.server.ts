import 'server-only'

import type { AlibabaDashscopeConnection } from '@lib/providers/registers/_shared/alibaba-dashscope-shared'
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { alibabaDashscopeCompatLanguageModel } from '@lib/providers/_internals/alibaba-dashscope-language-model'
import { parseModelConfig } from '@lib/providers/register-config'
import { DASHSCOPE_QWEN36_PLUS_DOC } from '@lib/providers/registers/_shared/alibaba-dashscope-shared'

export function buildAlibabaDashscopeQwen36PlusLanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as AlibabaDashscopeConnection
    return alibabaDashscopeCompatLanguageModel(config, DASHSCOPE_QWEN36_PLUS_DOC.modelId)
}
