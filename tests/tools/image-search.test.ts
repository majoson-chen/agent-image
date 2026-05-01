import { createImageSearchTool } from '@lib/tools/image-search'
/**
 * U4 — image-search 工具单测（test-first）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const BRAVE_IMAGE_RESPONSE = {
    results: [
        {
            title: 'Cute Corgi',
            url: 'https://example.com/page1',
            properties: { url: 'https://images.example.com/corgi1.jpg' },
            thumbnail: { src: 'https://images.example.com/thumb1.jpg' },
        },
    ],
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

describe('createImageSearchTool', () => {
    it('returns normalized items on success', async () => {
        mockFetchOk(BRAVE_IMAGE_RESPONSE)
        const tool = createImageSearchTool('BSA-key')
        const result = await tool.execute!({ query: 'corgi', count: 10 }, { abortSignal: undefined! } as never)
        expect(result.items).toHaveLength(1)
        expect(result.items[0]).toMatchObject({
            title: 'Cute Corgi',
            source: 'https://example.com/page1',
            image: 'https://images.example.com/corgi1.jpg',
        })
    })

    it('calls /images/search endpoint', async () => {
        mockFetchOk(BRAVE_IMAGE_RESPONSE)
        const tool = createImageSearchTool('BSA-key')
        await tool.execute!({ query: 'corgi' }, { abortSignal: undefined! } as never)
        const url = fetchSpy.mock.calls[0][0] as string
        expect(url).toContain('/images/search')
    })

    it('forwards abortSignal to fetch', async () => {
        mockFetchOk(BRAVE_IMAGE_RESPONSE)
        const tool = createImageSearchTool('BSA-key')
        const controller = new AbortController()
        await tool.execute!({ query: 'corgi' }, { abortSignal: controller.signal } as never)
        const callArgs = fetchSpy.mock.calls[0]
        expect((callArgs[1] as RequestInit)?.signal).toBe(controller.signal)
    })

    it('returns empty when results missing', async () => {
        mockFetchOk({})
        const tool = createImageSearchTool('BSA-key')
        const result = await tool.execute!({ query: 'nothing' }, { abortSignal: undefined! } as never)
        expect(result.items).toEqual([])
    })

    it('throws on 429 without exposing api key', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('Rate limited', { status: 429 }))
        const tool = createImageSearchTool('BSA-secret')
        await expect(
            tool.execute!({ query: 'test' }, { abortSignal: undefined! } as never),
        ).rejects.toThrow('429')
        try {
            await createImageSearchTool('BSA-secret').execute!({ query: 'test' }, { abortSignal: undefined! } as never)
        }
        catch (e) {
            expect(String(e)).not.toContain('BSA-secret')
        }
    })
})
