import { z } from 'zod'

/** AI SDK useChat 经 JSON POST 发来的最小 UIMessage 形状（仅服务端校验字段完备性） */
export const chatUiMessageSchema = z.object({
    id: z.string(),
    role: z.string(),
    parts: z.array(z.unknown()),
})

export const chatPostBodySchema = z.object({
    conversationId: z.string().min(1),
    messages: z.array(chatUiMessageSchema).optional(),
})

export type ChatPostBodyInput = z.infer<typeof chatPostBodySchema>
