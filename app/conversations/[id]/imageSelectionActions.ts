'use server'

import { revalidatePath } from 'next/cache'
import { getModel } from '../../../lib/db/models'
import { clearSelection, setSelection } from '../../../lib/db/selections'
import prisma from '../../../lib/prisma'

export async function setImageSelectionAction(
    conversationId: string,
    role: 'IMAGE_PRIMARY' | 'IMAGE_SECONDARY',
    modelId: string | null,
    size: string | null,
) {
    if (!modelId) {
        await clearSelection(prisma, conversationId, role)
    }
    else {
        // 验证 modelId 是 IMAGE 类型
        const model = await getModel(prisma, modelId)
        if (!model || model.type !== 'IMAGE')
            throw new Error('指定的模型不是生图模型')
        await setSelection(prisma, conversationId, role, modelId, size ? { size } : null)
    }
    revalidatePath(`/conversations/${conversationId}`)
}
