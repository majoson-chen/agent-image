import { z } from 'zod'
import { seedreamImageModelSchema, wanImageModelSchema } from './image-model-schema'
import { searchModelInputSchema } from './search-model-schema'

// LLM 分支（含 type 鉴别字段，用于 discriminatedUnion）
const llmBranchSchema = z.object({
    type: z.literal('LLM'),
    name: z.string().min(1, '名称不能为空'),
    providerType: z.enum(['OPENAI', 'OPENAI_COMPATIBLE', 'ALIBABA']),
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
    if (
        data.providerType === 'ALIBABA'
        && data.baseURL != null
        && data.baseURL.trim() === ''
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['baseURL'],
            message: 'ALIBABA 的 Base URL 若填写则不能为空字符串',
        })
    }
})

const searchBranchSchema = searchModelInputSchema.extend({ type: z.literal('SEARCH') })
const imageBranchSchema = z.union([
    seedreamImageModelSchema.extend({ type: z.literal('IMAGE') }),
    wanImageModelSchema.extend({ type: z.literal('IMAGE') }),
])

export const modelInputSchema = z.union([llmBranchSchema, searchBranchSchema, imageBranchSchema])

export type ModelInput = z.infer<typeof modelInputSchema>
