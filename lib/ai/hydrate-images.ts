import type { PrismaClient } from '../../generated/prisma/client'
import * as fs from 'node:fs/promises'
import { imagePath } from '../images/storage'
import 'server-only'

interface ImageRefPart {
    type: 'image-ref'
    imageId: string
}

interface ToolOutputPart {
    type: string
    state?: string
    output?: { imageId?: string }
}

interface MessageLike {
    id: string
    role: string
    parts: unknown[]
}

type HydratedPart
    = | { type: 'file', mediaType: string, url: string }
        | unknown

/** 从 assistant tool-image-* output 中提取 imageId */
function extractAssistantImageIds(parts: unknown[]): string[] {
    const ids: string[] = []
    for (const part of parts) {
        const p = part as ToolOutputPart
        if (
            (p.type?.startsWith('tool-image-generate') || p.type === 'tool-image-fetch')
            && p.state === 'output-available'
            && p.output?.imageId
        ) {
            ids.push(p.output.imageId)
        }
    }
    return ids
}

/** 按 source 生成 provenance prelude 文字 */
function buildProvenanceText(source: string, imageId: string, originalUrl: string | null): string {
    if (source === 'GENERATED')
        return `以下图像来自上一轮工具调用产出（imageId: ${imageId}）`
    if (source === 'URL_FETCHED')
        return `以下图像来自 image-fetch URL 抓取（原 URL: ${originalUrl ?? imageId}）`
    return `以下图像来自用户上传的参考图（imageId: ${imageId}）`
}

/**
 * UIMessage 数组中的 image-ref part 在喂给 LLM 前转换为 image bytes。
 * 同时将 assistant 生图 / 抓取图注入到最末一条 user message 之前。
 * 不修改原数组。
 */
export async function hydrateImagesForLLM(
    messages: MessageLike[],
    prisma: PrismaClient,
): Promise<MessageLike[]> {
    // Step 1: 收集 user image-ref IDs（用于去重，避免重复注入）
    const userImageRefIds = new Set<string>()
    for (const msg of messages) {
        if (msg.role.toLowerCase() !== 'user') continue
        for (const part of msg.parts) {
            const p = part as Record<string, unknown>
            if (p.type === 'image-ref' && typeof p.imageId === 'string') {
                userImageRefIds.add(p.imageId)
            }
        }
    }

    // Step 2: 收集 assistant 生图 IDs（按出现顺序，去重）
    const toInjectIds: string[] = []
    const seen = new Set<string>()
    for (const msg of messages) {
        if (msg.role.toLowerCase() !== 'assistant') continue
        for (const id of extractAssistantImageIds(msg.parts)) {
            if (!seen.has(id) && !userImageRefIds.has(id)) {
                seen.add(id)
                toInjectIds.push(id)
            }
        }
    }

    // Step 3: 找最末一条 user message 的 index（用于注入）
    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]!.role.toLowerCase() === 'user') {
            lastUserIdx = i
            break
        }
    }

    // Step 4: 构建待注入的 (text + image) pairs
    const injectedParts: HydratedPart[] = []
    if (toInjectIds.length > 0 && lastUserIdx !== -1) {
        for (const imageId of toInjectIds) {
            try {
                const image = await prisma.image.findUnique({ where: { id: imageId } })
                if (!image) {
                    console.warn(`[hydrate-images] assistant image not found: ${imageId}`)
                    continue
                }
                const filePath = imagePath(image.conversationId, image.id, image.mimeType)
                const buffer = await fs.readFile(filePath)
                const preludeText = buildProvenanceText(image.source, image.id, image.originalUrl ?? null)
                injectedParts.push({ type: 'text', text: preludeText })
                injectedParts.push({ type: 'file', mediaType: image.mimeType, url: `data:${image.mimeType};base64,${buffer.toString('base64')}` })
            }
            catch (err) {
                console.warn(`[hydrate-images] failed to load assistant image ${imageId}:`, err)
            }
        }
    }

    // Step 5: 遍历所有 messages，hydrate user image-ref + 注入 assistant 图
    const result: MessageLike[] = []

    for (let i = 0; i < messages.length; i++) {
        const message = messages[i]!

        const isUser = message.role.toLowerCase() === 'user'
        const isLastUser = isUser && i === lastUserIdx

        // 处理 user image-ref hydration
        let hasImageRef = false
        if (isUser) {
            for (const part of message.parts) {
                if ((part as Record<string, unknown>).type === 'image-ref') {
                    hasImageRef = true
                    break
                }
            }
        }

        if (!isUser && !isLastUser) {
            result.push(message)
            continue
        }

        // hydrate image-ref parts
        const hydratedParts: HydratedPart[] = []
        if (hasImageRef) {
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
                        type: 'file',
                        mediaType: image.mimeType,
                        url: `data:${image.mimeType};base64,${buffer.toString('base64')}`,
                    })
                }
                catch (err) {
                    console.warn(`[hydrate-images] failed to read image ${imageRef.imageId}:`, err)
                }
            }
        }
        else {
            hydratedParts.push(...message.parts)
        }

        // 如是最末 user message，在前面插入 assistant 生图注入 parts
        const finalParts = isLastUser && injectedParts.length > 0
            ? [...injectedParts, ...hydratedParts]
            : hydratedParts

        result.push({ ...message, parts: finalParts })
    }

    return result
}
