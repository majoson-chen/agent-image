/**
 * dashscope/wan-image：生图 tool；含可选 referenceImageIds（受 Register capabilities 限制）。
 */
import type { DashscopeWanImageConfig } from '@lib/providers/registers/dashscope-wan-image'
import type { CreateImageGenerateToolOptions } from '@lib/tools/registers/image/image-generate-tool-types'
import prismaDefault from '@lib/prisma'
import { loadConversationImageBuffer } from '@lib/providers/_internals/load-conversation-image'
import { parseModelConfig } from '@lib/providers/register-config'
import { executeImageGeneration } from '@lib/image-provider-factory'
import { redactSecretsInMessage } from '@lib/tools/_internals/redact-secrets-message'
import { tool } from 'ai'
import { z } from 'zod'
import 'server-only'

function buildWanImageToolInputSchema(model: CreateImageGenerateToolOptions['model']): z.ZodTypeAny {
    const base = z.object({
        prompt: z.string().min(1).max(2000),
    })
    if (model.type !== 'IMAGE' || model.registerId !== 'dashscope/wan-image')
        return base
    const config = parseModelConfig(model.registerId, model.config) as DashscopeWanImageConfig
    const maxRef = config.capabilities.maxReferenceImages
    if (maxRef <= 0)
        return base
    return base.extend({
        referenceImageIds: z.array(z.string().min(1)).max(maxRef).optional(),
    })
}

export function createDashscopeWanImageGenerateTool(opts: CreateImageGenerateToolOptions) {
    const { model, params, role, conversationId } = opts
    if (model.registerId !== 'dashscope/wan-image') {
        throw new Error(`expected dashscope/wan-image IMAGE model, got ${model.registerId}`)
    }

    const label = role === 'PRIMARY' ? '主生图' : '次生图'
    const inputSchema = buildWanImageToolInputSchema(model)

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
