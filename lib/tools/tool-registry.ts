import 'server-only'
import type { PrismaClient } from '../../generated/prisma/client'
import { getModel } from '../db/models'
import { getAllBindings } from '../db/search-tool-bindings'
import { createImageSearchTool } from './image-search'
import { createWebFetchTool } from './web-fetch'
import { createWebSearchTool } from './web-search'

type ToolSet = Record<string, { execute?: unknown }>

interface AvailableTools {
    tools: ToolSet
    /** 工具名称列表，供 system prompt 引用 */
    descriptors: string[]
}

export async function buildAvailableTools(prisma: PrismaClient): Promise<AvailableTools> {
    const bindings = await getAllBindings(prisma)
    const tools: ToolSet = {}

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

    const descriptors = Object.keys(tools)
    return { tools, descriptors }
}
