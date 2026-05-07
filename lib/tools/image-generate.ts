import type { DashscopeWanImageConfig } from '@lib/providers/registers/dashscope-wan-image'
import type { Model } from '~/generated/prisma/client'
import { executeImageGeneration } from '@lib/image-provider-factory'
import prismaDefault from '@lib/prisma'
import { loadConversationImageBuffer } from '@lib/providers/_internals/load-conversation-image'
import { parseModelConfig } from '@lib/providers/registry'
import { tool } from 'ai'
import { z } from 'zod'
import 'server-only'

function redactSecretsInMessage(message: string): string {
    return message
        .replace(/\bsk-\w{12,}\b/gi, '[redacted]')
        .replace(/Bearer\s+\S{10,}/gi, 'Bearer [redacted]')
}

interface CreateImageGenerateToolOptions {
    model: Model
    params: { size: string }
    role: 'PRIMARY' | 'SECONDARY'
    conversationId: string
}

function buildImageToolInputSchema(model: Model): z.ZodTypeAny {
    const base = z.object({
        prompt: z.string().min(1).max(2000),
    })
    if (model.type !== 'IMAGE')
        return base
    if (model.registerId !== 'dashscope/wan-image')
        return base
    const config = parseModelConfig(model.registerId, model.config) as DashscopeWanImageConfig
    const maxRef = config.capabilities.maxReferenceImages
    if (maxRef <= 0)
        return base
    return base.extend({
        referenceImageIds: z.array(z.string().min(1)).max(maxRef).optional(),
    })
}

export function createImageGenerateTool({
    model,
    params,
    role,
    conversationId,
}: CreateImageGenerateToolOptions) {
    const label = role === 'PRIMARY' ? '主生图' : '次生图'
    const inputSchema = buildImageToolInputSchema(model)

    return tool({
        description:
            `调用${label}模型生成图像。生成前必须经用户确认。可对万相模型附带本对话内已上传/已生成图像的 referenceImageIds 作参考。`,
        inputSchema,
        needsApproval: true,
        execute: async (input, { abortSignal }) => {
            const parsed = inputSchema.safeParse(input)
            if (!parsed.success) {
                return {
                    ok: false as const,
                    code: 'INVALID_INPUT',
                    message: parsed.error.message.slice(0, 500),
                }
            }

            const body = parsed.data as { prompt: string, referenceImageIds?: string[] }
            let referenceImages: Array<{ mimeType: string, base64: string }> | undefined
            try {
                if (body.referenceImageIds?.length) {
                    const buffers = await Promise.all(
                        body.referenceImageIds.map(id =>
                            loadConversationImageBuffer(prismaDefault, {
                                conversationId,
                                imageId: id,
                            }),
                        ),
                    )
                    referenceImages = buffers.map(({ buffer, mimeType }) => ({
                        mimeType,
                        base64: buffer.toString('base64'),
                    }))
                }

                return await executeImageGeneration({
                    model,
                    prompt: body.prompt,
                    size: params.size,
                    conversationId,
                    prisma: prismaDefault,
                    abortSignal,
                    referenceImages,
                })
            }
            catch (e) {
                const message = redactSecretsInMessage(e instanceof Error ? e.message : String(e))
                return {
                    ok: false as const,
                    code: 'IMAGE_GEN_FAILED',
                    message: message.slice(0, 500),
                }
            }
        },
    })
}
