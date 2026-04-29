import type { PrismaClient } from '../../generated/prisma/client'
import { tool } from 'ai'
import { z } from 'zod'
import { createImage } from '../db/images'
import { detectMime, isAllowedMime } from '../images/mime'
import { assertPublicHttpUrl } from './ssrf-guard'
import 'server-only'

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 30_000
const MAX_HOPS = 3

interface CreateImageFetchToolOptions {
    prisma: PrismaClient
    conversationId: string
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
            // 对 redirect 目标重新进行 SSRF 校验
            currentUrl = assertPublicHttpUrl(new URL(location, currentUrl).toString()).toString()
            continue
        }

        return res
    }

    throw new Error('too many redirects')
}

export function createImageFetchTool({ prisma, conversationId }: CreateImageFetchToolOptions) {
    return tool({
        description: '从公网 URL 抓取图像并存储，返回 imageId。用于将 image-search 候选 URL 转为可用图像。支持 PNG/JPEG/WEBP/GIF，最大 10 MB。',
        inputSchema: z.object({
            url: z.string().url(),
        }),
        execute: async ({ url }, { abortSignal }) => {
            const res = await fetchWithRedirectGuard(url, abortSignal)

            if (!res.ok)
                throw new Error(`fetch failed: HTTP ${res.status}`)

            // 校验 Content-Type MIME
            const rawContentType = res.headers.get('content-type') ?? ''
            const contentMime = rawContentType.split(';')[0]!.trim()
            if (!isAllowedMime(contentMime))
                throw new Error(`not an image MIME: ${contentMime}`)

            // 读取响应体并校验大小
            const arrayBuf = await res.arrayBuffer()
            const buffer = Buffer.from(arrayBuf)
            if (buffer.byteLength > MAX_SIZE_BYTES)
                throw new Error(`response body too large: ${buffer.byteLength} bytes (max ${MAX_SIZE_BYTES})`)

            // magic-byte 校验
            const detectedMime = detectMime(buffer)
            if (!detectedMime || !detectedMime.startsWith('image/'))
                throw new Error(`magic bytes do not match an image format (detected: ${detectedMime ?? 'unknown'})`)

            // createImage 内部负责落盘 + 写 DB
            const img = await createImage(prisma, {
                conversationId,
                source: 'URL_FETCHED',
                mimeType: contentMime,
                sizeBytes: buffer.byteLength,
                originalUrl: url,
                buffer,
            })

            return {
                imageId: img.id,
                mimeType: img.mimeType,
                sizeBytes: img.sizeBytes,
            }
        },
    })
}
