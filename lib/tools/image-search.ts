import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'

export function createImageSearchTool(apiKey: string) {
    return tool({
        description: '搜索互联网图片，返回图片 URL 和来源页面列表。用于查找相关图片资源。',
        inputSchema: z.object({
            query: z.string().min(1).max(400),
            count: z.number().int().min(1).max(200).optional().default(10),
        }),
        execute: async ({ query, count }, { abortSignal }) => {
            const url = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=${count}`
            const res = await fetch(url, {
                headers: {
                    'X-Subscription-Token': apiKey,
                    'Accept': 'application/json',
                },
                signal: abortSignal,
                redirect: 'manual',
            })

            if (!res.ok)
                throw new Error(`Brave image-search ${res.status}: request failed`)

            const json = await res.json() as {
                results?: Array<{
                    title?: string
                    url?: string
                    properties?: { url?: string }
                    thumbnail?: { src?: string }
                }>
            }
            const items = (json.results ?? []).map(r => ({
                title: r.title ?? '',
                source: r.url ?? '',
                image: r.properties?.url ?? '',
                thumbnail: r.thumbnail?.src ?? '',
            }))

            return { items }
        },
    })
}
