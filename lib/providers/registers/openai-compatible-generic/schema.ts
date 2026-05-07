/**
 * Register：openai-compatible/generic — 通用 OpenAI 兼容网关（须显式 baseURL）。
 */
import { z } from 'zod'

export const openaiCompatibleGenericConfigSchema = z.object({
    modelId: z.string().min(1),
    baseURL: z.string().url(),
    apiKey: z.string().min(1),
    extraHeaders: z.record(z.string(), z.string()).optional(),
})

export type OpenaiCompatibleGenericConfig = z.infer<typeof openaiCompatibleGenericConfigSchema>
