/**
 * Register：dashscope/wan-image — DashScope 万相生图；capabilities 继承通用图像能力并限制参考图张数。
 */
import { imageModelCapabilitiesSchema } from '@lib/validation/image-model-schema'
import { z } from 'zod'

export const dashscopeWanImageConfigSchema = z
    .object({
        requestModel: z.string().min(1),
        apiKey: z.string().min(1),
        baseURL: z.string().url().optional(),
        capabilities: imageModelCapabilitiesSchema,
    })
    .superRefine((data, ctx) => {
        if (data.capabilities.maxReferenceImages > 9) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['capabilities', 'maxReferenceImages'],
                message: '万相图像 API 最多 9 张参考图',
            })
        }
    })

export type DashscopeWanImageConfig = z.infer<typeof dashscopeWanImageConfigSchema>
