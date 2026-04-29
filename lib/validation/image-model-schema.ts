import { z } from 'zod'

function refineBaseURL(data: { baseURL?: string | undefined }, ctx: z.RefinementCtx) {
    if (data.baseURL != null) {
        try {
            const parsed = new URL(data.baseURL)
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['baseURL'],
                    message: 'Base URL 须为合法的 http(s) 地址',
                })
            }
        }
        catch {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['baseURL'],
                message: 'Base URL 须为合法的 http(s) 地址',
            })
        }
    }
}

const optionalHttpBaseURL = z.string().optional().transform(s => (!s?.trim() ? undefined : s.trim()))

export const imageModelCapabilitiesSchema = z.object({
    supportedSizes: z.array(z.string().regex(/^\d+x\d+$/, '格式应为 WxH，如 1024x1024')).min(1, '至少填写一项分辨率'),
    maxReferenceImages: z.number().int().min(0, '不能为负数').max(14, '最多 14 张'),
    supportsSeed: z.boolean().default(false),
})

export const seedreamImageModelSchema = z.object({
    name: z.string().min(1, '模型 ID 不能为空'),
    providerType: z.literal('VOLCENGINE_SEEDREAM'),
    apiKey: z.string().min(1, 'API Key 不能为空'),
    baseURL: optionalHttpBaseURL,
    capabilities: imageModelCapabilitiesSchema,
}).superRefine(refineBaseURL)

export const wanImageModelSchema = z.object({
    name: z.string().min(1, '模型 ID 不能为空'),
    providerType: z.literal('DASHSCOPE_WAN_IMAGE'),
    apiKey: z.string().min(1, 'API Key 不能为空'),
    baseURL: optionalHttpBaseURL,
    capabilities: imageModelCapabilitiesSchema,
}).superRefine(refineBaseURL).superRefine((data, ctx) => {
    if (data.capabilities.maxReferenceImages > 9) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['capabilities', 'maxReferenceImages'],
            message: '万相图像 API 最多 9 张参考图',
        })
    }
})

export const imageModelInputSchema = z.discriminatedUnion('providerType', [
    seedreamImageModelSchema,
    wanImageModelSchema,
])

export type ImageModelInput = z.infer<typeof imageModelInputSchema>
export type ImageModelCapabilities = z.infer<typeof imageModelCapabilitiesSchema>
