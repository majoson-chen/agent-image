import type { Model } from '~/generated/prisma/client'
import { executeImageGeneration } from '@lib/image-provider-factory'
import prismaDefault from '@lib/prisma'
import { tool } from 'ai'
import { z } from 'zod'
import 'server-only'

interface CreateImageGenerateToolOptions {
    model: Model
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
    const label = role === 'PRIMARY' ? '主生图' : '次生图'

    return tool({
        description: `调用${label}模型生成图像。生成前必须经用户确认。`,
        inputSchema: z.object({
            prompt: z.string().min(1).max(2000),
        }),
        needsApproval: true,
        execute: async ({ prompt }, { abortSignal }) => {
            try {
                return await executeImageGeneration({
                    model,
                    prompt,
                    size: params.size,
                    conversationId,
                    prisma: prismaDefault,
                    abortSignal,
                })
            }
            catch (e) {
                const message = e instanceof Error ? e.message : String(e)
                return {
                    ok: false as const,
                    code: 'IMAGE_GEN_FAILED',
                    message: message.slice(0, 500),
                }
            }
        },
    })
}
