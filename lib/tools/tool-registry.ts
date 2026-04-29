import type { ToolSet } from 'ai'
import type { PrismaClient } from '../../generated/prisma/client'
import type { ImageModelCapabilities } from '../validation/image-model-schema'
import { getModel } from '../db/models'
import { getAllBindings } from '../db/search-tool-bindings'
import { getSelection } from '../db/selections'
import { createImageGenerateTool } from './image-generate'
import { createImageSearchTool } from './image-search'
import { createWebFetchTool } from './web-fetch'
import { createWebSearchTool } from './web-search'
import 'server-only'

interface AvailableTools {
    tools: ToolSet
    /** 工具名称列表，供 system prompt 引用 */
    descriptors: string[]
}

export async function buildAvailableTools(prisma: PrismaClient, conversationId: string): Promise<AvailableTools> {
    const bindings = await getAllBindings(prisma)
    const tools = {} as ToolSet

    if (bindings.WEB_SEARCH) {
        const model = await getModel(prisma, bindings.WEB_SEARCH)
        if (!model)
            throw new Error(`Search model not found: ${bindings.WEB_SEARCH}`)
        tools['web-search'] = createWebSearchTool(model.apiKey)
    }

    if (bindings.IMAGE_SEARCH) {
        const model = await getModel(prisma, bindings.IMAGE_SEARCH)
        if (!model)
            throw new Error(`Search model not found: ${bindings.IMAGE_SEARCH}`)
        tools['image-search'] = createImageSearchTool(model.apiKey)
    }

    // web-fetch 始终可用，无绑定语义
    tools['web-fetch'] = createWebFetchTool()

    // 生图工具：按 conversation 级 IMAGE selection 暴露（R9）
    const primarySel = await getSelection(prisma, conversationId, 'IMAGE_PRIMARY')
    if (primarySel) {
        const model = await getModel(prisma, primarySel.modelId)
        if (model && model.capabilities) {
            const caps = model.capabilities as ImageModelCapabilities
            const defaultSize = caps.supportedSizes[0] ?? '1024x1024'
            const selParams = primarySel.params as { size?: string } | null
            tools['image-generate-primary'] = createImageGenerateTool({
                model: model as Parameters<typeof createImageGenerateTool>[0]['model'],
                params: { size: selParams?.size ?? defaultSize },
                role: 'PRIMARY',
                conversationId,
            })
        }
    }

    const secondarySel = await getSelection(prisma, conversationId, 'IMAGE_SECONDARY')
    if (secondarySel) {
        const model = await getModel(prisma, secondarySel.modelId)
        if (model && model.capabilities) {
            const caps = model.capabilities as ImageModelCapabilities
            const defaultSize = caps.supportedSizes[0] ?? '1024x1024'
            const selParams = secondarySel.params as { size?: string } | null
            tools['image-generate-secondary'] = createImageGenerateTool({
                model: model as Parameters<typeof createImageGenerateTool>[0]['model'],
                params: { size: selParams?.size ?? defaultSize },
                role: 'SECONDARY',
                conversationId,
            })
        }
    }

    const descriptors = Object.keys(tools)
    return { tools, descriptors }
}
