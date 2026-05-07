/**
 * Register：alibaba/dashscope-llm — 阿里云 DashScope 文本模型，能力字段可选下沉至 capabilities。
 */
import { z } from 'zod'

export const alibabaDashscopeLlmConfigSchema = z.object({
    modelId: z.string().min(1),
    apiKey: z.string().min(1),
    baseURL: z.string().url().optional(),
    extraHeaders: z.record(z.string(), z.string()).optional(),
    capabilities: z.object({ supportsThinking: z.boolean().optional() }).optional(),
})

export type AlibabaDashscopeLlmConfig = z.infer<typeof alibabaDashscopeLlmConfigSchema>
