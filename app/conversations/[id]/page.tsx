import type { ImageModelCapabilities } from '@lib/validation/image-model-schema'
import type { UIMessage } from 'ai'
import { mapDbMessagesToInitialMessages } from '@lib/conversations/initial-messages'
import { getConversation } from '@lib/db/conversations'
import { listMessages } from '@lib/db/messages'
import { listModels } from '@lib/db/models'
import { getAllSelections } from '@lib/db/selections'
import prisma from '@lib/prisma'
import { notFound } from 'next/navigation'
import { ChatPage } from './ChatPage'

/** 与 ChatPage 内 MessageMetadata 对齐，供初始消息类型断言 */
interface ChatMessageMetadata {
    usage?: { inputTokens: number, outputTokens: number, totalTokens: number }
}

interface Props {
    params: Promise<{ id: string }>
}

function configRecord(config: unknown): Record<string, unknown> {
    return config != null && typeof config === 'object' && !Array.isArray(config)
        ? config as Record<string, unknown>
        : {}
}

export default async function ConversationPage({ params }: Props) {
    const { id } = await params
    const conv = await getConversation(prisma, id)
    if (!conv)
        notFound()

    const [messages, selections, imageModels, llmModelRecords] = await Promise.all([
        listMessages(prisma, id),
        getAllSelections(prisma, id),
        listModels(prisma, 'IMAGE'),
        listModels(prisma, 'LLM'),
    ])

    const llmModel = selections.LLM?.model
    const primarySel = selections.IMAGE_PRIMARY
    const secondarySel = selections.IMAGE_SECONDARY

    const imageModelList = imageModels.map(m => ({
        id: m.id,
        name: m.name,
        capabilities: configRecord(m.config).capabilities as ImageModelCapabilities | null,
    }))
    const llmModelList = llmModelRecords.map(m => ({
        id: m.id,
        name: m.name,
        config: m.config,
    }))
    const llmParams = selections.LLM?.params as { thinkingEnabled?: boolean } | undefined
    const llmThinkingEnabled = llmParams?.thinkingEnabled === true

    return (
        <ChatPage
            conversationId={id}
            initialMessages={mapDbMessagesToInitialMessages(messages) as UIMessage<ChatMessageMetadata>[]}
            hasLlm={Boolean(llmModel)}
            llmModels={llmModelList}
            llmModelId={selections.LLM?.modelId ?? null}
            llmThinkingEnabled={llmThinkingEnabled}
            contextWindow={undefined}
            imageModels={imageModelList}
            primaryImageModelId={primarySel?.modelId ?? null}
            primaryImageSize={(primarySel?.params as { size?: string } | null)?.size ?? null}
            secondaryImageModelId={secondarySel?.modelId ?? null}
            secondaryImageSize={(secondarySel?.params as { size?: string } | null)?.size ?? null}
        />
    )
}
