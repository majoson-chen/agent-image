/**
 * Register：volcengine/seedream — 火山 Seedream 生图；HTTP body 的 model 来自 requestModel（非 DB name）。
 */
import { imageModelCapabilitiesSchema } from '@lib/validation/image-model-schema'
import { z } from 'zod'

export const volcengineSeedreamConfigSchema = z.object({
    requestModel: z.string().min(1),
    apiKey: z.string().min(1),
    baseURL: z.string().url().optional(),
    capabilities: imageModelCapabilitiesSchema,
})

export type VolcengineSeedreamConfig = z.infer<typeof volcengineSeedreamConfigSchema>
