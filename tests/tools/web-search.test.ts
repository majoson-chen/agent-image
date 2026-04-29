/**
 * U4 — web-search 工具单测（test-first）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebSearchTool } from '../../lib/tools/web-search'

const BRAVE_RESPONSE = {
    web: {
        results: [
            { title: 'Result 1', url: 'https://example.com/1', description: 'Desc 1' },
            { title: 'Result 2', url: 'https://example.com/2', description: 'Desc 2' },
        ],
    },
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
})

afterEach(() => {
    vi.restoreAllMocks()
})

function mockFetchOk(body: object) {
    fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }),
    )
}

describe('createWebSearchTool', () => {
    it('returns normalized items on success', async () => {
        mockFetchOk(BRAVE_RESPONSE)
        const tool = createWebSearchTool('BSA-key')
        const result = await tool.execute!({ query: 'test', count: 10 }, { abortSignal: undefined! } as never)
        expect(result.items).toHaveLength(2)
        expect(result.items[0]).toMatchObject({ title: 'Result 1', url: 'https://example.com/1', description: 'Desc 1' })
    })

    it('forwards abortSignal to fetch', async () => {
        mockFetchOk(BRAVE_RESPONSE)
        const tool = createWebSearchTool('BSA-key')
        const controller = new AbortController()
        await tool.execute!({ query: 'test', count: 5 }, { abortSignal: controller.signal } as never)
        const callArgs = fetchSpy.mock.calls[0]
        expect((callArgs[1] as RequestInit)?.signal).toBe(controller.signal)
    })

    it('sends correct headers including X-Subscription-Token', async () => {
        mockFetchOk(BRAVE_RESPONSE)
        const tool = createWebSearchTool('BSA-my-token')
        await tool.execute!({ query: 'hello' }, { abortSignal: undefined! } as never)
        const callArgs = fetchSpy.mock.calls[0]
        const headers = (callArgs[1] as RequestInit)?.headers as Record<string, string>
        expect(headers['X-Subscription-Token']).toBe('BSA-my-token')
    })

    it('returns empty items when web.results is empty', async () => {
        mockFetchOk({ web: { results: [] } })
        const tool = createWebSearchTool('BSA-key')
        const result = await tool.execute!({ query: 'nothing' }, { abortSignal: undefined! } as never)
        expect(result.items).toEqual([])
    })

    it('returns empty items when response has no web field', async () => {
        mockFetchOk({})
        const tool = createWebSearchTool('BSA-key')
        const result = await tool.execute!({ query: 'nothing' }, { abortSignal: undefined! } as never)
        expect(result.items).toEqual([])
    })

    it('throws on 401 without exposing the api key', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
        const tool = createWebSearchTool('BSA-secret-key')
        await expect(
            tool.execute!({ query: 'test' }, { abortSignal: undefined! } as never),
        ).rejects.toThrow('401')
        // 错误消息不含 apiKey
        try {
            await createWebSearchTool('BSA-secret-key').execute!({ query: 'test' }, { abortSignal: undefined! } as never)
        }
        catch (e) {
            expect(String(e)).not.toContain('BSA-secret-key')
        }
    })

    it('propagates AbortError when fetch is aborted', async () => {
        const abortErr = new DOMException('Aborted', 'AbortError')
        fetchSpy.mockRejectedValueOnce(abortErr)
        const tool = createWebSearchTool('BSA-key')
        const err = await tool.execute!({ query: 'test' }, { abortSignal: undefined! } as never).catch(e => e)
        expect(err).toBeInstanceOf(DOMException)
        expect((err as DOMException).name).toBe('AbortError')
    })
})
