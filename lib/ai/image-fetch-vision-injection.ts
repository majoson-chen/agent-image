import type { ModelMessage } from 'ai'
import type { PrismaClient } from '~/generated/prisma/client'
import { buildVisionInjectXml } from '@lib/ai/vision-inject-xml'
import { getImage } from '@lib/db/images'
import { readImageBuffer } from '@lib/images/storage'
import 'server-only'

/** 单次 image-fetch 工具调用对应的视觉注入批次（与其它 tool-call 区分开） */
export interface ImageFetchBatch {
    toolCallId: string
    /** ok:true 的图像，顺序与下游 file part  strictly 对齐 */
    images: Array<{ imageId: string, mimeType: string }>
    /** 同一次调用内的失败项摘要（不进 file，写入合成 user 文本） */
    failureNotes: string[]
}

/** 撕开 AI SDK tool-result 外层（如 `{ type:'json', value }`） */
export function unwrapToolOutput(output: unknown): unknown {
    if (!output || typeof output !== 'object')
        return output
    const o = output as Record<string, unknown>
    if (o.type === 'json' && 'value' in o)
        return o.value
    return output
}

/**
 * 解析 image-fetch 返回值：成功像素列表（按 index 排序）+ 失败说明行。
 * 兼容旧版单笔 `{ imageId, mimeType }`（无期 items）。
 */
export function parseImageFetchToolOutput(output: unknown): {
    successes: Array<{ imageId: string, mimeType: string }>
    failureNotes: string[]
} {
    const inner = unwrapToolOutput(output)
    if (!inner || typeof inner !== 'object') {
        return { successes: [], failureNotes: [] }
    }

    const o = inner as Record<string, unknown>

    if (Array.isArray(o.items)) {
        interface ParsedItemRow {
            idx: number
            raw: Record<string, unknown>
        }
        const mapped: ParsedItemRow[] = []
        for (let i = 0; i < o.items.length; i++) {
            const it = o.items[i]
            if (!it || typeof it !== 'object')
                continue
            const raw = it as Record<string, unknown>
            const idx = typeof raw.index === 'number' && Number.isFinite(raw.index) ? raw.index : i
            mapped.push({ idx, raw })
        }
        mapped.sort((a, b) => a.idx - b.idx)

        const successes: Array<{ imageId: string, mimeType: string }> = []
        const failureNotes: string[] = []
        for (const { idx, raw } of mapped) {
            if (raw.ok === true && typeof raw.imageId === 'string' && typeof raw.mimeType === 'string') {
                successes.push({ imageId: raw.imageId, mimeType: raw.mimeType })
            }
            else {
                const msg = typeof raw.error === 'string'
                    ? raw.error
                    : raw.ok === false
                        ? 'unknown error'
                        : 'missing success fields'
                failureNotes.push(`sources[${idx}]: ${msg}`)
            }
        }
        return { successes, failureNotes }
    }

    if (typeof o.imageId === 'string' && typeof o.mimeType === 'string') {
        return { successes: [{ imageId: o.imageId, mimeType: o.mimeType }], failureNotes: [] }
    }

    return { successes: [], failureNotes: [] }
}

/** @deprecated 请用 parseImageFetchToolOutput；保留别名避免外部引用断裂 */
export function normalizeImageFetchOutput(output: unknown): Array<{ imageId: string, mimeType: string }> {
    return parseImageFetchToolOutput(output).successes
}

interface StepToolResultPart {
    type: string
    toolName?: string
    toolCallId?: string
    output?: unknown
}

/**
 * 从某一步的 step.content 中收集 image-fetch 成功后可注入的视觉批次。
 * 若整次调用无成功项则无批次（仅靠工具 JSON 告知失败）。
 */
export function extractImageFetchBatchesFromStep(step: { content: ReadonlyArray<StepToolResultPart> }): ImageFetchBatch[] {
    const batches: ImageFetchBatch[] = []
    for (const part of step.content) {
        if (part.type !== 'tool-result')
            continue
        if (part.toolName !== 'image-fetch' || !part.toolCallId)
            continue

        const { successes, failureNotes } = parseImageFetchToolOutput(part.output)
        if (successes.length === 0)
            continue

        batches.push({
            toolCallId: part.toolCallId,
            images: successes,
            failureNotes,
        })
    }
    return batches
}

/** 为 ModelMessage 构造 file parts（字节真值，供本轮后续 LLM 调用） */
export async function buildVisionUserModelMessage(
    prisma: PrismaClient,
    conversationId: string,
    batches: ImageFetchBatch[],
): Promise<ModelMessage> {
    const content: Array<
        | { type: 'text', text: string }
        | { type: 'file', mediaType: string, data: Buffer }
    > = [
        { type: 'text', text: buildVisionInjectXml(batches) },
    ]

    for (const b of batches) {
        for (const img of b.images) {
            const row = await getImage(prisma, img.imageId)
            if (!row || row.conversationId !== conversationId) {
                throw new Error(`vision inject: image not in conversation: ${img.imageId}`)
            }
            const data = await readImageBuffer(row.conversationId, row.id, row.mimeType)
            content.push({
                type: 'file',
                mediaType: img.mimeType,
                data,
            })
        }
    }

    return { role: 'user', content } as ModelMessage
}

/** 持久化用的 UIMessage parts（file 使用 data URL，避免 JSON 存 Buffer） */
export async function buildVisionUserUiParts(
    prisma: PrismaClient,
    conversationId: string,
    batches: ImageFetchBatch[],
): Promise<object[]> {
    const parts: object[] = [{ type: 'text', text: buildVisionInjectXml(batches) }]
    for (const b of batches) {
        for (const img of b.images) {
            const row = await getImage(prisma, img.imageId)
            if (!row || row.conversationId !== conversationId)
                throw new Error(`vision persist: image not in conversation: ${img.imageId}`)
            const data = await readImageBuffer(row.conversationId, row.id, row.mimeType)
            const base64 = data.toString('base64')
            const url = `data:${img.mimeType};base64,${base64}`
            parts.push({
                type: 'file',
                mediaType: img.mimeType,
                url,
            })
        }
    }
    return parts
}
