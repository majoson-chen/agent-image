import { tool } from 'ai'
import { z } from 'zod'
import { assertPublicHttpUrl } from './ssrf-guard'
import 'server-only'

const MAX_TEXT_BYTES = 50_000
const FETCH_TIMEOUT_MS = 30_000

export function createWebFetchTool() {
    return tool({
        description: '抓取指定 URL 的网页内容，返回原始文本（截断到约 50KB）。用于阅读搜索结果中的具体页面。仅支持 http/https 公网地址。',
        inputSchema: z.object({
            url: z.string().url(),
        }),
        execute: async ({ url }, { abortSignal }) => {
            const parsed = assertPublicHttpUrl(url)

            const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
            const combinedSignal = AbortSignal.any(
                abortSignal ? [abortSignal, timeoutSignal] : [timeoutSignal],
            )

            const res = await fetch(parsed, {
                signal: combinedSignal,
                redirect: 'manual',
                headers: { 'User-Agent': 'agent-image/m2' },
            })

            if (!res.ok)
                throw new Error(`fetch ${res.status}`)

            const text = await res.text()
            return {
                url: parsed.toString(),
                status: res.status,
                contentType: res.headers.get('content-type') ?? '',
                text: text.slice(0, MAX_TEXT_BYTES),
            }
        },
    })
}
