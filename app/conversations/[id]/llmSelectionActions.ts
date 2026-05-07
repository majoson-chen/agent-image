'use server'

import { getModel } from '@lib/db/models'
import { clearSelection, setSelection } from '@lib/db/selections'
import prisma from '@lib/prisma'
import { revalidatePath } from 'next/cache'

export async function setLlmSelectionAction(
    conversationId: string,
    modelId: string | null,
) {
    if (!modelId) {
        await clearSelection(prisma, conversationId, 'LLM')
        revalidatePath(`/conversations/${conversationId}`)
        return
    }

    const model = await getModel(prisma, modelId)
    if (!model || model.type !== 'LLM')
        throw new Error('指定的模型不是 LLM')

    /** thinking 等指标由模型 config 驱动，选型行不存 LLM params */
    await setSelection(prisma, conversationId, 'LLM', modelId, null)
    revalidatePath(`/conversations/${conversationId}`)
}
