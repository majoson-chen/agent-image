'use server'

import { revalidatePath } from 'next/cache'
import { getModel } from '../../../lib/db/models'
import { clearSelection, setSelection } from '../../../lib/db/selections'
import { llmSupportsThinking } from '../../../lib/llm-chat-provider-options'
import prisma from '../../../lib/prisma'

export async function setLlmSelectionAction(
    conversationId: string,
    modelId: string | null,
    opts?: { thinkingEnabled?: boolean } | null,
) {
    if (!modelId) {
        await clearSelection(prisma, conversationId, 'LLM')
        revalidatePath(`/conversations/${conversationId}`)
        return
    }

    const model = await getModel(prisma, modelId)
    if (!model || model.type !== 'LLM')
        throw new Error('指定的模型不是 LLM')

    const toWrite
        = llmSupportsThinking(model.capabilities) && opts?.thinkingEnabled === true
            ? { thinkingEnabled: true as const }
            : null

    await setSelection(prisma, conversationId, 'LLM', modelId, toWrite)
    revalidatePath(`/conversations/${conversationId}`)
}
