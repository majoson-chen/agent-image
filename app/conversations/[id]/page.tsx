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
            initialMessages={messages.map(m => ({
                id: m.id,
                role: m.role.toLowerCase() as 'user' | 'assistant',
                parts: [{ type: 'text' as const, text: m.content }],
            }))}
            hasLlm={Boolean(llmModel)}
            contextWindow={llmModel?.contextWindow ?? undefined}
        />
    )
}
