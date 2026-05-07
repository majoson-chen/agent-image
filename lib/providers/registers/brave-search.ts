/**
 * Register：brave/search — Brave Search API，仅需 API Key。
 */
import { z } from 'zod'

export const braveSearchConfigSchema = z.object({
    apiKey: z.string().min(1),
})

export type BraveSearchConfig = z.infer<typeof braveSearchConfigSchema>
