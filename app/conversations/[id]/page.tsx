import type { ImageModelCapabilities } from '../../../lib/validation/image-model-schema'
import { notFound } from 'next/navigation'
import { getConversation } from '../../../lib/db/conversations'
import { listMessages } from '../../../lib/db/messages'
import { listModels } from '../../../lib/db/models'
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

    const [messages, selections, imageModels] = await Promise.all([
        listMessages(prisma, id),
        getAllSelections(prisma, id),
        listModels(prisma, 'IMAGE'),
    ])

    const llmModel = selections.LLM?.model
    const primarySel = selections.IMAGE_PRIMARY
    const secondarySel = selections.IMAGE_SECONDARY

    const imageModelList = imageModels.map(m => ({
        id: m.id,
        name: m.name,
        capabilities: m.capabilities as ImageModelCapabilities | null,
    }))

    return (
        <ChatPage
            conversationId={id}
            initialMessages={messages.map((m) => {
                const role = m.role.toLowerCase() as 'user' | 'assistant'
                if (role === 'user') {
                    return { id: m.id, role, parts: [{ type: 'text' as const, text: m.content }] }
                }
                const parts = m.parts !== null
                    ? m.parts as object[]
                    : [{ type: 'text' as const, text: m.content }]
                return { id: m.id, role, parts }
            })}
            hasLlm={Boolean(llmModel)}
            contextWindow={llmModel?.contextWindow ?? undefined}
            imageModels={imageModelList}
            primaryImageModelId={primarySel?.modelId ?? null}
            primaryImageSize={(primarySel?.params as { size?: string } | null)?.size ?? null}
            primaryImageMaxRefs={primarySel?.model
                ? ((primarySel.model.capabilities as ImageModelCapabilities | null)?.maxReferenceImages ?? 0)
                : null}
            secondaryImageModelId={secondarySel?.modelId ?? null}
            secondaryImageSize={(secondarySel?.params as { size?: string } | null)?.size ?? null}
        />
    )
}
