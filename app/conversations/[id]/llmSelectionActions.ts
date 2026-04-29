'use server'

import { revalidatePath } from 'next/cache'
import { getModel } from '../../../lib/db/models'
import { clearSelection, setSelection } from '../../../lib/db/selections'
import prisma from '../../../lib/prisma'

export async function setLlmSelectionAction(conversationId: string, modelId: string | null) {
    if (!modelId) {
        await clearSelection(prisma, conversationId, 'LLM')
    }
    else {
        const model = await getModel(prisma, modelId)
        if (!model || model.type !== 'LLM')
            throw new Error('指定的模型不是 LLM')
        await setSelection(prisma, conversationId, 'LLM', modelId)
    }
    revalidatePath(`/conversations/${conversationId}`)
}
