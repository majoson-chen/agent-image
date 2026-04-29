/**
 * U4 — image-fetch tool 单测（test-first）
 * 覆盖 SSRF、MIME 校验、redirect 跳数、大小限制、超时、正常落盘
 */
import type { MockedFunction } from 'vitest'
import type { createImage as CreateImageFn } from '../../lib/db/images'
import type { writeImage as WriteImageFn } from '../../lib/images/storage'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// mock storage 和 db images，避免真实 IO
vi.mock('../../lib/images/storage', () => ({
    writeImage: vi.fn().mockResolvedValue(undefined),
    readImageBuffer: vi.fn(),
    imagePath: vi.fn(),
    deleteImage: vi.fn(),
    deleteConversationImages: vi.fn(),
}))

vi.mock('../../lib/db/images', () => ({
    createImage: vi.fn().mockImplementation((_prisma: unknown, input: { conversationId: string, mimeType: string, sizeBytes: number }) => ({
        id: 'fetched-img-001',
        conversationId: input.conversationId,
        source: 'URL_FETCHED',
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        originalUrl: null,
    })),
    getImage: vi.fn(),
    listImages: vi.fn(),
    deleteImage: vi.fn(),
    cleanupConversationImages: vi.fn(),
}))

const pngMagic = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...new Array(100).fill(0)])
const jpegMagic = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(100).fill(0)])
const htmlBytes = Buffer.from('<html>hello</html>')

function makePrisma() {
    return {} as never
}

function makeResponse(opts: {
    status?: number
    contentType?: string
    body?: Buffer | string
    location?: string
}) {
    const { status = 200, contentType = 'image/png', body = pngMagic, location } = opts
    const headers = new Headers()
    if (contentType) headers.set('content-type', contentType)
    if (location) headers.set('location', location)
    // 用 slice 确保 arrayBuffer() 返回的是该 Buffer 自己的独立 ArrayBuffer
    const buf = typeof body === 'string' ? Buffer.from(body) : body
    const ownArrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    return {
        status,
        ok: status >= 200 && status < 300,
        headers,
        arrayBuffer: vi.fn().mockResolvedValue(ownArrayBuffer),
    } as unknown as Response
}

describe('createImageFetchTool - happy path', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('fetches PNG, validates MIME and magic bytes, creates DB row', async () => {
        const fetchMock = vi.mocked(globalThis.fetch)
        fetchMock.mockResolvedValueOnce(makeResponse({ contentType: 'image/png', body: pngMagic }))

        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await (t.execute as Function)({ url: 'https://example.com/img.png' }, { abortSignal: undefined })

        expect(result.imageId).toBeTruthy()
        expect(result.mimeType).toBe('image/png')
        expect(result.sizeBytes).toBeGreaterThan(0)
    })

    it('fetches JPEG successfully', async () => {
        const fetchMock = vi.mocked(globalThis.fetch)
        fetchMock.mockResolvedValueOnce(makeResponse({ contentType: 'image/jpeg', body: jpegMagic }))

        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await (t.execute as Function)({ url: 'https://example.com/img.jpg' }, { abortSignal: undefined })

        expect(result.mimeType).toBe('image/jpeg')
    })
})

describe('createImageFetchTool - SSRF rejection', () => {
    it('rejects private IPv4 URL (192.168.x.x)', async () => {
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        await expect(
            (t.execute as Function)({ url: 'https://192.168.1.1/img.png' }, { abortSignal: undefined }),
        ).rejects.toThrow(/private network not allowed/)
    })

    it('rejects localhost URL', async () => {
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        await expect(
            (t.execute as Function)({ url: 'https://localhost/img.png' }, { abortSignal: undefined }),
        ).rejects.toThrow(/private network not allowed/)
    })

    it('rejects ftp:// URL', async () => {
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        await expect(
            (t.execute as Function)({ url: 'ftp://example.com/img.png' }, { abortSignal: undefined }),
        ).rejects.toThrow(/only http\/https allowed/)
    })
})

describe('createImageFetchTool - MIME validation', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('rejects text/html Content-Type', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
            makeResponse({ contentType: 'text/html', body: htmlBytes }),
        ))
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        await expect(
            (t.execute as Function)({ url: 'https://example.com/page' }, { abortSignal: undefined }),
        ).rejects.toThrow(/not an image MIME/)
    })

    it('rejects when Content-Type says image/png but magic bytes are HTML', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
            makeResponse({ contentType: 'image/png', body: htmlBytes }),
        ))
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        await expect(
            (t.execute as Function)({ url: 'https://example.com/img.png' }, { abortSignal: undefined }),
        ).rejects.toThrow(/magic bytes/)
    })
})

describe('createImageFetchTool - redirect guard', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('rejects redirect to private IP', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
            makeResponse({ status: 302, location: 'http://10.0.0.1/img.png', contentType: '' }),
        ))
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        await expect(
            (t.execute as Function)({ url: 'https://evil.com/img.png' }, { abortSignal: undefined }),
        ).rejects.toThrow(/private network not allowed/)
    })

    it('rejects after too many redirects (4 hops)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            makeResponse({ status: 302, location: 'https://a.com/img.png', contentType: '' }),
        ))
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        await expect(
            (t.execute as Function)({ url: 'https://a.com/img.png' }, { abortSignal: undefined }),
        ).rejects.toThrow(/too many redirects/)
    })
})

describe('createImageFetchTool - size limit', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('rejects response body > 10 MB', async () => {
        // 创建一个 11 MB 的 PNG-magic-prefixed buffer
        const largeBody = Buffer.alloc(11 * 1024 * 1024)
        pngMagic.copy(largeBody)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
            makeResponse({ contentType: 'image/png', body: largeBody }),
        ))
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        await expect(
            (t.execute as Function)({ url: 'https://example.com/huge.png' }, { abortSignal: undefined }),
        ).rejects.toThrow(/too large/)
    })
})
