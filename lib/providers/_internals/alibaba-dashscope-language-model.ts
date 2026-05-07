/**
 * DashScope OpenAI-compat：已解析 connection + 请求 model 名 → LanguageModel（内核）。
 */
import type { AlibabaDashscopeConnection } from '@lib/providers/registers/_shared/alibaba-dashscope-shared'
import type { LanguageModel } from 'ai'
import { createAlibaba } from '@ai-sdk/alibaba'
import { DASHSCOPE_COMPAT_BASE_MAINLAND } from '@lib/providers/registers/_shared/alibaba-dashscope-shared'
import 'server-only'

export function alibabaDashscopeCompatLanguageModel(
    connection: AlibabaDashscopeConnection,
    requestModelId: string,
): LanguageModel {
    const provider = createAlibaba({
        apiKey: connection.apiKey,
        baseURL: connection.baseURL ?? DASHSCOPE_COMPAT_BASE_MAINLAND,
        headers: connection.extraHeaders,
    })
    return provider(requestModelId)
}
