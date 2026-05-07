/**
 * Agent GPT-5.5: Models API 的统一创建/更新载荷入口。
 *
 * 只校验 HTTP/DB helper 的外层形状；registerId 与 config 的语义校验由 provider registry 负责。
 */
import { z } from 'zod'

const base = z.object({
    name: z.string().min(1, '名称不能为空'),
    registerId: z.string().min(1, 'registerId 不能为空'),
    config: z.unknown(),
})

export const modelCreateBodySchema = z.discriminatedUnion('type', [
    base.extend({ type: z.literal('LLM') }),
    base.extend({ type: z.literal('IMAGE') }),
    base.extend({ type: z.literal('SEARCH') }),
])

export const modelPatchBodySchema = z.object({
    name: z.string().min(1, '名称不能为空').optional(),
    registerId: z.string().min(1, 'registerId 不能为空').optional(),
    config: z.unknown().optional(),
})

export type ModelCreateBody = z.infer<typeof modelCreateBodySchema>
export type ModelPatchBody = z.infer<typeof modelPatchBodySchema>
