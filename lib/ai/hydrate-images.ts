import type { Buffer } from 'node:buffer'
import type { PrismaClient } from '../../generated/prisma/client'
import * as fs from 'node:fs/promises'
import { imagePath } from '../images/storage'
import 'server-only'

interface ImageRefPart {
    type: 'image-ref'
    imageId: string
}

interface MessageLike {
    id: string
    role: string
    parts: unknown[]
}

type HydratedPart
    = | { type: 'image', image: Buffer, mimeType: string }
        | unknown

/**
 * UIMessage 数组中的 image-ref part 在喂给 LLM 前转换为 image bytes。
 * 仅处理 user message 中的 image-ref；不修改原数组。
 */
export async function hydrateImagesForLLM(
    messages: MessageLike[],
    prisma: PrismaClient,
): Promise<MessageLike[]> {
    const result: MessageLike[] = []

    for (const message of messages) {
        let hasImageRef = false
        for (const part of message.parts) {
            if ((part as Record<string, unknown>).type === 'image-ref') {
                hasImageRef = true
                break
            }
        }

        if (!hasImageRef) {
            result.push(message)
            continue
        }

        const hydratedParts: HydratedPart[] = []
        for (const part of message.parts) {
            const p = part as Record<string, unknown>
            if (p.type !== 'image-ref') {
                hydratedParts.push(part)
                continue
            }

            const imageRef = p as unknown as ImageRefPart
            try {
                const image = await prisma.image.findUnique({ where: { id: imageRef.imageId } })
                if (!image) {
                    console.warn(`[hydrate-images] image not found: ${imageRef.imageId}`)
                    continue
                }
                const filePath = imagePath(image.conversationId, image.id, image.mimeType)
                const buffer = await fs.readFile(filePath)
                hydratedParts.push({
                    type: 'image',
                    image: buffer,
                    mimeType: image.mimeType,
                })
            }
            catch (err) {
                console.warn(`[hydrate-images] failed to read image ${imageRef.imageId}:`, err)
            }
        }

        result.push({ ...message, parts: hydratedParts })
    }

    return result
}
