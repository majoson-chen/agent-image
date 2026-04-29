import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'

export function createWebSearchTool(apiKey: string) {
    return tool({
        description: '搜索互联网网页内容，返回标题/URL/简介列表。用于查找实时信息或核实事实。',
        inputSchema: z.object({
            query: z.string().min(1).max(400),
            count: z.number().int().min(1).max(20).optional().default(10),
        }),
        execute: async ({ query, count }, { abortSignal }) => {
            const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`
            const res = await fetch(url, {
                headers: {
                    'X-Subscription-Token': apiKey,
                    'Accept': 'application/json',
                },
                signal: abortSignal,
                redirect: 'manual',
            })

            if (!res.ok)
                throw new Error(`Brave web-search ${res.status}: request failed`)

            const json = await res.json() as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } }
            const items = (json.web?.results ?? []).map(r => ({
                title: r.title ?? '',
                url: r.url ?? '',
                description: r.description ?? '',
            }))

            return { items }
        },
    })
}
