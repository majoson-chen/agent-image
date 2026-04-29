import { z } from 'zod'
import { searchModelInputSchema } from './search-model-schema'

// LLM 分支（含 type 鉴别字段，用于 discriminatedUnion）
const llmBranchSchema = z.object({
    type: z.literal('LLM'),
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

// 鉴别联合：搜索分支额外补 type 字段（供 modelInputSchema 区分用）
const searchBranchSchema = searchModelInputSchema.extend({ type: z.literal('SEARCH') })

export const modelInputSchema = z.union([llmBranchSchema, searchBranchSchema])

export type ModelInput = z.infer<typeof modelInputSchema>
