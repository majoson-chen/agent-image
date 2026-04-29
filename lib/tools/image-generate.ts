import type { Model } from '../../generated/prisma/client'
import type { ImageModelCapabilities } from '../validation/image-model-schema'
import { tool } from 'ai'
import { z } from 'zod'
import { executeImageGeneration } from '../image-provider-factory'
import { readImageBuffer } from '../images/storage'
import prismaDefault from '../prisma'
import 'server-only'

interface ImageModelRecord extends Model {
    providerType: 'VOLCENGINE_SEEDREAM' | 'DASHSCOPE_WAN_IMAGE'
    capabilities: ImageModelCapabilities
}

interface CreateImageGenerateToolOptions {
    model: ImageModelRecord | (Omit<Model, 'capabilities'> & { capabilities: ImageModelCapabilities })
    params: { size: string }
    role: 'PRIMARY' | 'SECONDARY'
    conversationId: string
}

export function createImageGenerateTool({
    model,
    params,
    role,
    conversationId,
}: CreateImageGenerateToolOptions) {
    const capabilities = model.capabilities as ImageModelCapabilities
    const maxRefs = capabilities.maxReferenceImages

    const baseSchema = z.object({
        prompt: z.string().min(1).max(2000),
    })

    const inputSchema = maxRefs > 0
        ? baseSchema.extend({
                referenceImageIds: z.array(z.string()).max(maxRefs).optional(),
            })
        : baseSchema

    const label = role === 'PRIMARY' ? '主生图' : '次生图'

    return tool({
        description: `调用${label}模型生成图像。生成前必须经用户确认。`,
        inputSchema,
        needsApproval: true,
        execute: async ({ prompt, referenceImageIds }: { prompt: string, referenceImageIds?: string[] }, { abortSignal }) => {
            return executeImageGeneration({
                model: model as never,
                prompt,
                referenceImageIds: referenceImageIds ?? [],
                size: params.size,
                conversationId,
                prisma: prismaDefault,
                abortSignal,
            })
        },
        toModelOutput: async ({ output }) => {
            const { imageId, mimeType } = output as { imageId: string, mimeType: string }
            try {
                const buffer = await readImageBuffer(conversationId, imageId, mimeType)
                return { type: 'content' as const, value: [{ type: 'image-data' as const, data: buffer.toString('base64'), mediaType: mimeType }] }
            }
            catch {
                return { type: 'json' as const, value: output as never }
            }
        },
    })
}
