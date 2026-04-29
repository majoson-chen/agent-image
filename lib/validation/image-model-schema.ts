import { z } from 'zod'

export const imageModelCapabilitiesSchema = z.object({
    supportedSizes: z.array(z.string().regex(/^\d+x\d+$/, '格式应为 WxH，如 1024x1024')).min(1, '至少填写一项分辨率'),
    maxReferenceImages: z.number().int().min(0, '不能为负数').max(14, '最多 14 张'),
    supportsSeed: z.boolean().default(false),
})

export const imageModelInputSchema = z.object({
    name: z.string().min(1, '模型 ID 不能为空'),
    providerType: z.literal('VOLCENGINE_SEEDREAM'),
    apiKey: z.string().min(1, 'API Key 不能为空'),
    /** 留空则用工厂默认 LAS 网关；若非空须为合法 http(s) URL */
    baseURL: z.string().optional().transform(s => (!s?.trim() ? undefined : s.trim())),
    capabilities: imageModelCapabilitiesSchema,
}).superRefine((data, ctx) => {
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
})

export type ImageModelInput = z.infer<typeof imageModelInputSchema>
export type ImageModelCapabilities = z.infer<typeof imageModelCapabilitiesSchema>
