/**
 * 将 user 消息中指向本地 `/api/images/{id}` 的 file part 展开为 data URL，
 * 供 `convertToModelMessages` / Provider 消费（避免相对 URL 在服务端无法解析）。
 */
import type { PrismaClient } from '~/generated/prisma/client'
import { getImage } from '@lib/db/images'
import { readImageBuffer } from '@lib/images/storage'
import 'server-only'

const API_IMAGE_PREFIX = '/api/images/'

export interface UiMessageForHydration {
    id: string
    role: 'user' | 'assistant'
    parts: object[]
}

export async function hydrateApiImageFilePartsForModel(
    prisma: PrismaClient,
    conversationId: string,
    uiMessages: UiMessageForHydration[],
): Promise<UiMessageForHydration[]> {
    return Promise.all(
        uiMessages.map(async (msg) => {
            if (msg.role !== 'user')
                return msg

            const parts = await Promise.all(
                msg.parts.map(async (part) => {
                    const p = part as { type?: string, url?: string, mediaType?: string }
                    if (p.type !== 'file' || typeof p.url !== 'string')
                        return part

                    if (!p.url.startsWith(API_IMAGE_PREFIX))
                        return part

                    const imageId = p.url.slice(API_IMAGE_PREFIX.length).split(/[?#]/)[0] ?? ''
                    if (!imageId)
                        return part

                    const row = await getImage(prisma, imageId)
                    if (!row || row.conversationId !== conversationId)
                        return part

                    const buf = await readImageBuffer(row.conversationId, row.id, row.mimeType)
                    const mediaType = typeof p.mediaType === 'string' && p.mediaType.length > 0
                        ? p.mediaType
                        : row.mimeType
                    const b64 = buf.toString('base64')
                    return {
                        type: 'file',
                        mediaType,
                        url: `data:${mediaType};base64,${b64}`,
                    }
                }),
            )

            return { ...msg, parts }
        }),
    )
}
