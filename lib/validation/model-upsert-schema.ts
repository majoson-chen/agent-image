/**
 * Agent GPT-5.5: Models API 的统一创建/更新载荷入口。
 *
 * 创建：`superRefine` 与 `parseModelConfig` 同源校验 config；更新仍由 `updateModel` 内解析。
 */
import { parseModelConfig } from '@lib/providers/register-config'
import { z, ZodError } from 'zod'

const base = z.object({
    name: z.string().min(1, '名称不能为空'),
    registerId: z.string().min(1, 'registerId 不能为空'),
    config: z.unknown(),
})

export const modelCreateBodySchema = z.discriminatedUnion('type', [
    base.extend({ type: z.literal('LLM') }),
    base.extend({ type: z.literal('IMAGE') }),
    base.extend({ type: z.literal('SEARCH') }),
]).superRefine((data, ctx) => {
    try {
        parseModelConfig(data.registerId, data.config)
    }
    catch (e) {
        if (e instanceof ZodError) {
            for (const issue of e.issues) {
                ctx.addIssue({
                    ...issue,
                    path: ['config', ...(issue.path ?? [])],
                })
            }
        }
        else {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: e instanceof Error ? e.message : String(e),
                path: ['config'],
            })
        }
    }
})

export const modelPatchBodySchema = z.object({
    name: z.string().min(1, '名称不能为空').optional(),
    registerId: z.string().min(1, 'registerId 不能为空').optional(),
    config: z.unknown().optional(),
})

export type ModelCreateBody = z.infer<typeof modelCreateBodySchema>
export type ModelPatchBody = z.infer<typeof modelPatchBodySchema>
