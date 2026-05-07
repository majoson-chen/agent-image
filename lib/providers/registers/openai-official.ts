/**
 * Register：openai/official — OpenAI 官方 LLM，config 含模型名与 API Key。
 */
import { z } from 'zod'

export const openaiOfficialConfigSchema = z.object({
    /** 调用 `createOpenAI(...).languageModel(modelId)` 的模型名 */
    modelId: z.string().min(1),
    apiKey: z.string().min(1),
})

export type OpenaiOfficialConfig = z.infer<typeof openaiOfficialConfigSchema>
