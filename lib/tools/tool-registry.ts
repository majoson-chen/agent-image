import type { BraveSearchConfig } from '@lib/providers/registers/brave-search'
import type { DashscopeWanImageConfig } from '@lib/providers/registers/dashscope-wan-image'
import type { VolcengineSeedreamConfig } from '@lib/providers/registers/volcengine-seedream'
import type { ToolSet } from 'ai'
import type { Model, PrismaClient } from '~/generated/prisma/client'
import { getModel } from '@lib/db/models'
import { getAllBindings } from '@lib/db/search-tool-bindings'
import { getSelection } from '@lib/db/selections'
import { parseModelConfig } from '@lib/providers/registry'
import { createConversationRenameTool } from './conversation-rename'
import { createImageFetchTool } from './image-fetch'
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

type ImageRegisterConfig = DashscopeWanImageConfig | VolcengineSeedreamConfig

function getBraveApiKey(model: Model): string {
    const config = parseModelConfig('brave/search', model.config) as BraveSearchConfig
    return config.apiKey
}

function getImageRegisterConfig(model: Model): ImageRegisterConfig | null {
    if (model.type !== 'IMAGE')
        return null
    if (model.registerId !== 'volcengine/seedream' && model.registerId !== 'dashscope/wan-image')
        return null
    return parseModelConfig(model.registerId, model.config) as ImageRegisterConfig
}

export async function buildAvailableTools(prisma: PrismaClient, conversationId: string): Promise<AvailableTools> {
    const bindings = await getAllBindings(prisma)
    const tools = {} as ToolSet

    tools['conversation-rename'] = createConversationRenameTool({ conversationId, prisma })

    if (bindings.WEB_SEARCH) {
        const model = await getModel(prisma, bindings.WEB_SEARCH)
        if (!model)
            throw new Error(`Search model not found: ${bindings.WEB_SEARCH}`)
        tools['web-search'] = createWebSearchTool(getBraveApiKey(model))
    }

    if (bindings.IMAGE_SEARCH) {
        const model = await getModel(prisma, bindings.IMAGE_SEARCH)
        if (!model)
            throw new Error(`Search model not found: ${bindings.IMAGE_SEARCH}`)
        tools['image-search'] = createImageSearchTool(getBraveApiKey(model))
    }

    // web-fetch / image-fetch 始终可用，无绑定语义
    tools['web-fetch'] = createWebFetchTool()
    tools['image-fetch'] = createImageFetchTool({ prisma, conversationId })

    // 生图工具：按 conversation 级 IMAGE selection 暴露（R9）
    const primarySel = await getSelection(prisma, conversationId, 'IMAGE_PRIMARY')
    if (primarySel) {
        const model = await getModel(prisma, primarySel.modelId)
        const config = model ? getImageRegisterConfig(model) : null
        if (model && config) {
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
        const config = model ? getImageRegisterConfig(model) : null
        if (model && config) {
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
