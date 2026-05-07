import type { BraveSearchConfig } from '@lib/providers/registers/brave-search'
import type { ImageRegisterCatalogRow } from '@lib/providers/registry'
import type { ToolSet } from 'ai'
import type { Model, PrismaClient } from '~/generated/prisma/client'
import { getModel } from '@lib/db/models'
import { getAllBindings } from '@lib/db/search-tool-bindings'
import { getSelection } from '@lib/db/selections'
import { getImageCatalogRowStrict, parseModelConfig } from '@lib/providers/registry'
import { createBraveImageSearchTool, createBraveWebSearchTool } from '@lib/tools/registers/search/brave-search-tools'
import { createConversationRenameTool } from './conversation-rename'
import { createImageFetchTool } from './image-fetch'
import { createImageGenerateTool } from './image-generate'
import { createWebFetchTool } from './web-fetch'
import 'server-only'

interface AvailableTools {
    tools: ToolSet
    /** 工具名称列表，供 system prompt 引用 */
    descriptors: string[]
}

/** 与现网一致：从已解析 IMAGE config 取 supportedSizes */
interface ImageToolSelectionConfig {
    capabilities: { supportedSizes: string[] }
}

function getImageCatalogRowOrNull(model: Model): ImageRegisterCatalogRow | null {
    if (model.type !== 'IMAGE')
        return null
    try {
        return getImageCatalogRowStrict(model.registerId)
    }
    catch {
        return null
    }
}

function getBraveApiKey(model: Model): string {
    const config = parseModelConfig('brave/search', model.config) as BraveSearchConfig
    return config.apiKey
}

export async function buildAvailableTools(prisma: PrismaClient, conversationId: string): Promise<AvailableTools> {
    const bindings = await getAllBindings(prisma)
    const tools = {} as ToolSet

    tools['conversation-rename'] = createConversationRenameTool({ conversationId, prisma })

    if (bindings.WEB_SEARCH) {
        const model = await getModel(prisma, bindings.WEB_SEARCH)
        if (!model)
            throw new Error(`Search model not found: ${bindings.WEB_SEARCH}`)
        tools['web-search'] = createBraveWebSearchTool(getBraveApiKey(model))
    }

    if (bindings.IMAGE_SEARCH) {
        const model = await getModel(prisma, bindings.IMAGE_SEARCH)
        if (!model)
            throw new Error(`Search model not found: ${bindings.IMAGE_SEARCH}`)
        tools['image-search'] = createBraveImageSearchTool(getBraveApiKey(model))
    }

    // web-fetch / image-fetch 始终可用，无绑定语义
    tools['web-fetch'] = createWebFetchTool()
    tools['image-fetch'] = createImageFetchTool({ prisma, conversationId })

    // 生图工具：按 conversation 级 IMAGE selection 暴露（R9）
    const primarySel = await getSelection(prisma, conversationId, 'IMAGE_PRIMARY')
    if (primarySel) {
        const model = await getModel(prisma, primarySel.modelId)
        const imageRow = model ? getImageCatalogRowOrNull(model) : null
        if (model && imageRow) {
            const config = parseModelConfig(model.registerId, model.config) as ImageToolSelectionConfig
            const defaultSize = config.capabilities.supportedSizes[0] ?? '1024x1024'
            const selParams = primarySel.params as { size?: string } | null
            tools['image-generate-primary'] = createImageGenerateTool({
                model,
                params: { size: selParams?.size ?? defaultSize },
                role: 'PRIMARY',
                conversationId,
            })
        }
    }

    const secondarySel = await getSelection(prisma, conversationId, 'IMAGE_SECONDARY')
    if (secondarySel) {
        const model = await getModel(prisma, secondarySel.modelId)
        const imageRow = model ? getImageCatalogRowOrNull(model) : null
        if (model && imageRow) {
            const config = parseModelConfig(model.registerId, model.config) as ImageToolSelectionConfig
            const defaultSize = config.capabilities.supportedSizes[0] ?? '1024x1024'
            const selParams = secondarySel.params as { size?: string } | null
            tools['image-generate-secondary'] = createImageGenerateTool({
                model,
                params: { size: selParams?.size ?? defaultSize },
                role: 'SECONDARY',
                conversationId,
            })
        }
    }

    const descriptors = Object.keys(tools)
    return { tools, descriptors }
}
