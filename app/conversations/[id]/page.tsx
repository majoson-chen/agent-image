import { notFound } from 'next/navigation'
import { getConversation } from '../../../lib/db/conversations'
import { listMessages } from '../../../lib/db/messages'
import { getAllSelections } from '../../../lib/db/selections'
import prisma from '../../../lib/prisma'
import { ChatPage } from './ChatPage'

interface Props {
    params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: Props) {
    const { id } = await params
    const conv = await getConversation(prisma, id)
    if (!conv)
        notFound()

    const [messages, selections] = await Promise.all([
        listMessages(prisma, id),
        getAllSelections(prisma, id),
    ])

    const llmModel = selections.LLM?.model

    return (
        <ChatPage
            conversationId={id}
            initialMessages={messages.map(m => {
                const role = m.role.toLowerCase() as 'user' | 'assistant'
                if (role === 'user') {
                    return { id: m.id, role, parts: [{ type: 'text' as const, text: m.content }] }
                }
                // assistant：M2 消息有 parts JSON，M1 旧消息 parts=null 用 content fallback
                const parts = m.parts !== null
                    ? m.parts as object[]
                    : [{ type: 'text' as const, text: m.content }]
                return { id: m.id, role, parts }
            })}
            hasLlm={Boolean(llmModel)}
            contextWindow={llmModel?.contextWindow ?? undefined}
        />
    )
}
