import type { PrismaClient } from '../../generated/prisma/client'
import { tool } from 'ai'
import { z } from 'zod'
import { renameConversation } from '../db/conversations'
import prismaDefault from '../prisma'
import { CONVERSATION_TITLE_MAX, parseConversationTitle } from '../validation/conversation-title'
import 'server-only'

interface Options {
    conversationId: string
    prisma?: PrismaClient
}

/**
 * 将**当前会话**改名为短标题；conversationId 由服务端注入，不向模型暴露 id。
 */
export function createConversationRenameTool({ conversationId, prisma = prismaDefault }: Options) {
    return tool({
        description: '将当前对话改名为简短、可扫一眼的标题（仅本会话生效）。适合在话题已明朗时更新侧栏显示名。',
        inputSchema: z.object({
            title: z.string().min(1).max(CONVERSATION_TITLE_MAX),
        }),
        execute: async ({ title }: { title: string }) => {
            const p = parseConversationTitle(title)
            if (!p.ok)
                throw new Error(p.message)
            await renameConversation(prisma, conversationId, p.title)
            return { title: p.title }
        },
    })
}
