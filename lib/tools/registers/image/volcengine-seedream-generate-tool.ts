import type { CreateImageGenerateToolOptions } from '@lib/tools/registers/image/image-generate-tool-types'
import prismaDefault from '@lib/prisma'
/**
 * volcengine/seedream：生图 tool 绑定（prompt only，无参考图 input）。
 */
import { executeImageGeneration } from '@lib/providers/registers/_shared/image-execute/execute.server'
import { redactSecretsInMessage } from '@lib/tools/_internals/redact-secrets-message'
import { tool } from 'ai'
import { z } from 'zod'
import 'server-only'

export function createVolcengineSeedreamImageGenerateTool(opts: CreateImageGenerateToolOptions) {
    const { model, params, role, conversationId } = opts
    if (model.registerId !== 'volcengine/seedream') {
        throw new Error(`expected volcengine/seedream IMAGE model, got ${model.registerId}`)
    }

    const label = role === 'PRIMARY' ? '主生图' : '次生图'
    const inputSchema = z.object({
        prompt: z.string().min(1).max(2000),
    })

    return tool({
        description:
            `调用${label}模型生成图像。生成前必须经用户确认。`,
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

            try {
                return await executeImageGeneration({
                    model,
                    prompt: parsed.data.prompt,
                    size: params.size,
                    conversationId,
                    prisma: prismaDefault,
                    abortSignal,
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
