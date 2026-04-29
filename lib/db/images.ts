import type { ImageSource, PrismaClient } from '../../generated/prisma/client'
import { deleteConversationImages, deleteImage as deleteImageFile, writeImage } from '../images/storage'
import 'server-only'

interface CreateImageInput {
    conversationId: string
    source: ImageSource
    mimeType: string
    sizeBytes: number
    width?: number | null
    height?: number | null
    modelIdAtTime?: string | null
    /** 仅 URL_FETCHED 时传入 */
    originalUrl?: string | null
    buffer: Buffer
}

export async function createImage(prisma: PrismaClient, input: CreateImageInput) {
    const { conversationId, source, mimeType, sizeBytes, width, height, modelIdAtTime, originalUrl, buffer } = input

    const imageId = crypto.randomUUID()

    // 先写盘，失败则不创建 DB
    await writeImage(conversationId, imageId, mimeType, buffer)

    try {
        return await prisma.image.create({
            data: {
                id: imageId,
                conversationId,
                source,
                mimeType,
                sizeBytes,
                width: width ?? null,
                height: height ?? null,
                modelIdAtTime: modelIdAtTime ?? null,
                originalUrl: originalUrl ?? null,
            },
        })
    }
    catch (e) {
        // DB 创建失败，回滚文件
        await deleteImageFile(conversationId, imageId, mimeType).catch(() => {})
        throw e
    }
}

export async function getImage(prisma: PrismaClient, id: string) {
    return prisma.image.findUnique({ where: { id } })
}

export async function listImages(prisma: PrismaClient, conversationId: string) {
    return prisma.image.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } })
}

export async function deleteImage(prisma: PrismaClient, id: string): Promise<void> {
    const img = await getImage(prisma, id)
    if (!img)
        return

    await deleteImageFile(img.conversationId, img.id, img.mimeType)
    await prisma.image.delete({ where: { id } })
}

/** 删除对话时先清理本地文件，再让 DB CASCADE 自动清理 Image 行 */
export async function cleanupConversationImages(prisma: PrismaClient, conversationId: string): Promise<void> {
    await deleteConversationImages(conversationId)
}
