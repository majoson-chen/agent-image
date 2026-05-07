/**
 * Register：alibaba/dashscope-llm — 阿里云 DashScope 通用（自填 modelId）。
 */
import { alibabaDashscopeConnectionSchema } from '@lib/providers/registers/_shared/alibaba-dashscope-shared'
import { z } from 'zod'

export const alibabaDashscopeLlmConfigSchema = alibabaDashscopeConnectionSchema.extend({
    modelId: z.string().min(1),
})

export type AlibabaDashscopeLlmConfig = z.infer<typeof alibabaDashscopeLlmConfigSchema>
