import { createWebFetchTool } from '@lib/tools/web-fetch'
/**
 * U4 — web-fetch 工具单测（test-first）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
})

afterEach(() => {
    vi.restoreAllMocks()
})

function mockFetchOk(text: string, contentType = 'text/html') {
    fetchSpy.mockResolvedValueOnce(
        new Response(text, {
            status: 200,
            headers: { 'Content-Type': contentType },
        }),
    )
}

describe('createWebFetchTool', () => {
    it('returns page content on success', async () => {
        mockFetchOk('<html><body>Hello</body></html>')
        const tool = createWebFetchTool()
        const result = await tool.execute!({ url: 'https://example.com' }, { abortSignal: undefined! } as never)
        expect(result.status).toBe(200)
        expect(result.text).toContain('Hello')
        expect(result.url).toBe('https://example.com/')
    })

    it('truncates text to 50000 chars', async () => {
        const longText = 'a'.repeat(60000)
        mockFetchOk(longText)
        const tool = createWebFetchTool()
        const result = await tool.execute!({ url: 'https://example.com' }, { abortSignal: undefined! } as never)
        expect(result.text.length).toBe(50000)
    })

    it('forwards abortSignal to fetch', async () => {
        mockFetchOk('content')
        const tool = createWebFetchTool()
        const controller = new AbortController()
        await tool.execute!({ url: 'https://example.com' }, { abortSignal: controller.signal } as never)
        const callArgs = fetchSpy.mock.calls[0]
        // signal 是组合 signal（AbortSignal.any），只验证 fetch 收到了某个 signal
        expect((callArgs[1] as RequestInit)?.signal).toBeDefined()
    })

    it('throws on 404', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        const tool = createWebFetchTool()
        await expect(
            tool.execute!({ url: 'https://example.com/missing' }, { abortSignal: undefined! } as never),
        ).rejects.toThrow('404')
    })

    it('rejects localhost URLs without making a fetch', async () => {
        const tool = createWebFetchTool()
        await expect(
            tool.execute!({ url: 'http://localhost/x' }, { abortSignal: undefined! } as never),
        ).rejects.toThrow('private network not allowed')
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('rejects file:// URLs without making a fetch', async () => {
        const tool = createWebFetchTool()
        await expect(
            tool.execute!({ url: 'file:///etc/passwd' }, { abortSignal: undefined! } as never),
        ).rejects.toThrow('only http/https allowed')
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('rejects private IP 10.0.0.1', async () => {
        const tool = createWebFetchTool()
        await expect(
            tool.execute!({ url: 'http://10.0.0.1' }, { abortSignal: undefined! } as never),
        ).rejects.toThrow('private network not allowed')
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('rejects invalid URL', async () => {
        const tool = createWebFetchTool()
        await expect(
            tool.execute!({ url: 'not-a-url' }, { abortSignal: undefined! } as never),
        ).rejects.toThrow()
    })
})
