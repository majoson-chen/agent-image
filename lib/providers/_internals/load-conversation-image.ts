/**
 * 校验 image 归属对话后读取本地图像字节（供生图参考图等 SKU 使用）。
 */
import type { PrismaClient } from '~/generated/prisma/client'
import { readImageBuffer } from '@lib/images/storage'
import 'server-only'

export class ConversationImageNotFoundError extends Error {
    constructor() {
        super('IMAGE_NOT_FOUND')
        this.name = 'ConversationImageNotFoundError'
    }
}

/** imageId 不属于该 conversation（含不存在） */
export class ConversationImageForbiddenError extends Error {
    constructor() {
        super('IMAGE_NOT_IN_CONVERSATION')
        this.name = 'ConversationImageForbiddenError'
    }
}

export async function loadConversationImageBuffer(
    prisma: PrismaClient,
    params: { conversationId: string, imageId: string },
): Promise<{ buffer: Buffer, mimeType: string }> {
    const row = await prisma.image.findUnique({ where: { id: params.imageId } })
    if (!row)
        throw new ConversationImageNotFoundError()
    if (row.conversationId !== params.conversationId)
        throw new ConversationImageForbiddenError()

    const buffer = await readImageBuffer(row.conversationId, row.id, row.mimeType)
    return { buffer, mimeType: row.mimeType }
}
