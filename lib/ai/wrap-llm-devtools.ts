/**
 * 开发环境下将 LLM 包一层 @ai-sdk/devtools（生产不启用）。
 */
import type { LanguageModel } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'
import { wrapLanguageModel } from 'ai'
import 'server-only'

export function wrapLlmWithDevToolsIfDev(model: LanguageModel): LanguageModel {
    if (process.env.NODE_ENV !== 'development')
        return model

    return wrapLanguageModel({
        model,
        middleware: devToolsMiddleware(),
    })
}
