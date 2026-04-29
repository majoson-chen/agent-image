import { z } from 'zod'

export const llmModelInputSchema = z.object({
    name: z.string().min(1, '名称不能为空'),
    providerType: z.enum(['OPENAI', 'OPENAI_COMPATIBLE']),
    baseURL: z.string().optional(),
    apiKey: z.string().min(1, 'API Key 不能为空'),
    contextWindow: z.number().int().positive('上下文窗口必须为正整数'),
    extraHeaders: z.record(z.string(), z.string()).optional(),
    capabilities: z.record(z.string(), z.unknown()).optional(),
}).superRefine((data, ctx) => {
    if (data.providerType === 'OPENAI_COMPATIBLE' && !data.baseURL?.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['baseURL'],
            message: 'OPENAI_COMPATIBLE 类型必须填写 Base URL',
        })
    }
})

export type LlmModelInput = z.infer<typeof llmModelInputSchema>
