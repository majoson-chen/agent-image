import type { PrismaClient } from '~/generated/prisma/client'
import { createImage, getImage } from '@lib/db/images'
import { detectMime, isAllowedMime } from '@lib/images/mime'
import { readImageBuffer } from '@lib/images/storage'
import { tool } from 'ai'
import { z } from 'zod'
import { assertPublicHttpUrl } from './ssrf-guard'
import 'server-only'

/** 与计划 R2 一致：单次最多源数量 */
export const IMAGE_FETCH_MAX_SOURCES = 10

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 30_000
const MAX_HOPS = 3

export const imageFetchSourceSchema = z
    .object({
        url: z.string().url().optional(),
        imageId: z.string().min(1).optional(),
    })
    .superRefine((val, ctx) => {
        const hasUrl = val.url != null && val.url.length > 0
        const hasId = val.imageId != null && val.imageId.length > 0
        if (hasUrl === hasId) {
            ctx.addIssue({
                code: 'custom',
                message: '每项须且仅能指定 url 或 imageId 之一',
                path: hasUrl && hasId ? ['url'] : ['url'],
            })
        }
    })

export const imageFetchInputSchema = z.object({
    sources: z
        .array(imageFetchSourceSchema)
        .min(1, 'sources 不能为空')
        .max(IMAGE_FETCH_MAX_SOURCES, `sources 最多 ${IMAGE_FETCH_MAX_SOURCES} 项`),
})

export type ImageFetchInput = z.infer<typeof imageFetchInputSchema>

/** 逐项结果（index 对应 sources 下标） */
export type ImageFetchItemResult
    = | { index: number, ok: true, imageId: string, mimeType: string, sizeBytes: number }
        | { index: number, ok: false, error: string }

export interface ImageFetchToolOutput {
    items: ImageFetchItemResult[]
    /** 给模型的说明：成功时提示下一条 user 消息才带像素、请先等待；全部失败则说明不会注入图像 */
    notice: string
}

interface CreateImageFetchToolOptions {
    prisma: PrismaClient
    conversationId: string
}

function errMsg(e: unknown): string {
    if (e instanceof Error)
        return e.message
    return String(e)
}

/**
 * 带 SSRF 校验的 redirect 跟踪 fetch。
 * 每次 3xx 都重新校验 Location URL，超过 MAX_HOPS 抛错。
 */
async function fetchWithRedirectGuard(url: string, signal?: AbortSignal): Promise<Response> {
    let currentUrl = assertPublicHttpUrl(url).toString()

    for (let hop = 0; hop <= MAX_HOPS; hop++) {
        const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutSignal])
            : timeoutSignal

        const res = await fetch(currentUrl, {
            redirect: 'manual',
            signal: combinedSignal,
            headers: { 'User-Agent': 'agent-image/m4' },
        })

        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location')
            if (!location)
                throw new Error('redirect without location header')
            currentUrl = assertPublicHttpUrl(new URL(location, currentUrl).toString()).toString()
            continue
        }

        return res
    }

    throw new Error('too many redirects')
}

async function processUrlSource(
    prisma: PrismaClient,
    conversationId: string,
    url: string,
    abortSignal?: AbortSignal,
): Promise<Pick<Extract<ImageFetchItemResult, { ok: true }>, 'imageId' | 'mimeType' | 'sizeBytes'> | { error: string }> {
    try {
        const res = await fetchWithRedirectGuard(url, abortSignal)

        if (!res.ok)
            return { error: `fetch failed: HTTP ${res.status}` }

        const rawContentType = res.headers.get('content-type') ?? ''
        const contentMime = rawContentType.split(';')[0]!.trim()
        if (!isAllowedMime(contentMime))
            return { error: `not an image MIME: ${contentMime}` }

        const arrayBuf = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuf)
        if (buffer.byteLength > MAX_SIZE_BYTES)
            return { error: `response body too large: ${buffer.byteLength} bytes (max ${MAX_SIZE_BYTES})` }

        const detectedMime = detectMime(buffer)
        if (!detectedMime || !detectedMime.startsWith('image/'))
            return { error: `magic bytes do not match an image format (detected: ${detectedMime ?? 'unknown'})` }

        const img = await createImage(prisma, {
            conversationId,
            source: 'URL_FETCHED',
            mimeType: contentMime,
            sizeBytes: buffer.byteLength,
            originalUrl: url,
            buffer,
        })

        return { imageId: img.id, mimeType: img.mimeType, sizeBytes: img.sizeBytes }
    }
    catch (e) {
        return { error: errMsg(e) }
    }
}

async function processImageIdSource(
    prisma: PrismaClient,
    conversationId: string,
    imageId: string,
): Promise<Pick<Extract<ImageFetchItemResult, { ok: true }>, 'imageId' | 'mimeType' | 'sizeBytes'> | { error: string }> {
    try {
        const row = await getImage(prisma, imageId)
        if (!row)
            return { error: `image not found: ${imageId}` }
        if (row.conversationId !== conversationId)
            return { error: `imageId 不属于当前会话: ${imageId}` }

        await readImageBuffer(row.conversationId, row.id, row.mimeType)

        return {
            imageId: row.id,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
        }
    }
    catch (e) {
        return { error: errMsg(e) }
    }
}

export function createImageFetchTool({ prisma, conversationId }: CreateImageFetchToolOptions) {
    return tool({
        description:
            `按顺序拉取图像供后续视觉推理使用（**不需要用户确认**）。输入 sources 为数组，每项**二选一**：\`url\`（公网 HTTP(S) 图像）或 \`imageId\`（本会话已存在的图，如刚生成的 imageId）。最多 ${IMAGE_FETCH_MAX_SOURCES} 项。返回值含 \`items\`（按 index 与 sources 对齐）与 \`notice\`：**务必先完整阅读 notice**——它会说明像素实际出现在**紧随其后的另一条 user 消息**里，本条工具 JSON 中没有图像；仅在 ok:true 时才会触发该注入。`,
        inputSchema: imageFetchInputSchema,
        execute: async ({ sources }, { abortSignal }): Promise<ImageFetchToolOutput> => {
            const items: ImageFetchItemResult[] = []

            for (let index = 0; index < sources.length; index++) {
                const src = sources[index]!
                if (src.url) {
                    const r = await processUrlSource(prisma, conversationId, src.url, abortSignal)
                    if ('error' in r)
                        items.push({ index, ok: false, error: r.error })
                    else
                        items.push({ index, ok: true, ...r })
                }
                else if (src.imageId) {
                    const r = await processImageIdSource(prisma, conversationId, src.imageId)
                    if ('error' in r)
                        items.push({ index, ok: false, error: r.error })
                    else
                        items.push({ index, ok: true, ...r })
                }
                else {
                    items.push({ index, ok: false, error: 'internal: empty source' })
                }
            }

            const okCount = items.filter(i => i.ok).length
            const notice = okCount > 0
                ? [
                        `本次共有 ${okCount} 项 sources 成功（见 items 中 ok:true）。真实图像会以 file 像素形式写在**下一轮对话里紧随其后的一条 role=user 消息**中（先有一段结构化 XML，再是多张图）；在当前这条工具结果里你还看不到像素。`,
                        '请先不要根据「画面细节」作答或断言图像内容；等该条 user 消息到达并读完其中的图像后再继续描述、分析或决策。',
                    ].join('\n')
                : '本次没有任何成功的 sources（items 中无 ok:true），系统不会追加带图像的用户消息；请仅根据上方 items 中的错误摘要向用户说明或调整策略，不要假想已看到图。'

            return { items, notice }
        },
    })
}
