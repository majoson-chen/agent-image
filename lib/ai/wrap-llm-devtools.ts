/**
 * 开发环境下将 LLM 包一层 @ai-sdk/devtools（生产不启用）。
 * `wrapLanguageModel` 仅接受 v3实例；网关字符串 / v2 model 跳过包装。
 */
import type { LanguageModel } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'
import { wrapLanguageModel } from 'ai'
import 'server-only'

type LanguageModelV3Instance = Extract<LanguageModel, { specificationVersion: 'v3' }>

function isLanguageModelV3(model: LanguageModel): model is LanguageModelV3Instance {
    return typeof model === 'object' && model !== null && 'specificationVersion' in model
        && (model as { specificationVersion?: unknown }).specificationVersion === 'v3'
}

export function wrapLlmWithDevToolsIfDev(model: LanguageModel): LanguageModel {
    if (process.env.NODE_ENV !== 'development')
        return model

    if (!isLanguageModelV3(model))
        return model

    return wrapLanguageModel({
        model,
        middleware: devToolsMiddleware(),
    })
}
