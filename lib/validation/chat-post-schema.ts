import { z } from 'zod'

/** SPEC §4.2 user-turn：parts 与 UIMessage 同构，本层只做数组级校验 */
const userTurnSchema = z.object({
    kind: z.literal('user-turn'),
    conversationId: z.string().min(1),
    messageId: z.string().min(1),
    parts: z.array(z.unknown()),
    role: z.literal('user').optional(),
})

const approvalItemSchema = z.object({
    approvalId: z.string().min(1),
    approved: z.boolean(),
    reason: z.string().optional(),
    toolCallId: z.string().min(1).optional(),
})

/** SPEC §4.3 tool-approval */
const toolApprovalSchema = z.object({
    kind: z.literal('tool-approval'),
    conversationId: z.string().min(1),
    assistantMessageId: z.string().min(1),
    approvals: z.array(approvalItemSchema).min(1),
})

export const chatPostBodySchema = z.discriminatedUnion('kind', [userTurnSchema, toolApprovalSchema])

export type ChatPostBodyInput = z.infer<typeof chatPostBodySchema>
export type ChatPostUserTurnInput = z.infer<typeof userTurnSchema>
export type ChatPostToolApprovalInput = z.infer<typeof toolApprovalSchema>
