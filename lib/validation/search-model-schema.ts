import { z } from 'zod'

export const searchModelInputSchema = z.object({
    type: z.literal('SEARCH'),
    providerType: z.literal('BRAVE_SEARCH'),
    name: z.string().min(1, '名称不能为空'),
    apiKey: z.string().min(1, 'Subscription Token 不能为空'),
})

export type SearchModelInput = z.infer<typeof searchModelInputSchema>
