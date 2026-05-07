/**
 * brave/search：由 Model 行构造 web / image 搜索工具（Kernel 零 Brave 字面量）。
 */
import type { BraveSearchConfig } from '@lib/providers/registers/brave-search'
import type { Tool } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { parseModelConfig } from '@lib/providers/register-config'
import {
    createBraveImageSearchTool,
    createBraveWebSearchTool,
} from '@lib/tools/registers/search/brave-search-tools'
import 'server-only'

export function buildBraveSearchToolsForModel(model: Model): { webSearch: Tool, imageSearch: Tool } {
    if (model.type !== 'SEARCH' || model.registerId !== 'brave/search')
        throw new Error(`expected brave/search SEARCH model, got ${model.registerId}`)
    const config = parseModelConfig(model.registerId, model.config) as BraveSearchConfig
    const key = config.apiKey
    return {
        webSearch: createBraveWebSearchTool(key),
        imageSearch: createBraveImageSearchTool(key),
    }
}
