/**
 * U1 / U4 — image-fetch：`sources[]`（url | imageId）、批量逐项结果、SSRF/MIME/redirect/大小
 */
import type { ImageFetchInput, ImageFetchToolOutput } from '@lib/tools/image-fetch'
import {
    IMAGE_FETCH_MAX_SOURCES,
    imageFetchInputSchema,
} from '@lib/tools/image-fetch'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function execImageFetch(
    tool: { execute?: (input: ImageFetchInput, options: { abortSignal?: AbortSignal }) => Promise<ImageFetchToolOutput> },
    input: ImageFetchInput,
): Promise<ImageFetchToolOutput> {
    if (!tool.execute)
        throw new Error('missing execute')
    return tool.execute(input, { abortSignal: undefined })
}

vi.mock('../../lib/images/storage', () => ({
    writeImage: vi.fn().mockResolvedValue(undefined),
    readImageBuffer: vi.fn(),
    imagePath: vi.fn(),
    deleteImage: vi.fn(),
    deleteConversationImages: vi.fn(),
}))

let createImageSeq = 0
vi.mock('../../lib/db/images', () => ({
    createImage: vi.fn().mockImplementation((_prisma: unknown, input: { conversationId: string, mimeType: string, sizeBytes: number }) => {
        createImageSeq += 1
        return Promise.resolve({
            id: `new-img-${createImageSeq}`,
            conversationId: input.conversationId,
            source: 'URL_FETCHED',
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            originalUrl: null,
        })
    }),
    getImage: vi.fn(),
    listImages: vi.fn(),
    deleteImage: vi.fn(),
    cleanupConversationImages: vi.fn(),
}))

const pngMagic = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array.from({ length: 100 }).fill(0)])
const jpegMagic = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...Array.from({ length: 100 }).fill(0)])
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
    if (contentType)
        headers.set('content-type', contentType)
    if (location)
        headers.set('location', location)
    const buf = typeof body === 'string' ? Buffer.from(body) : body
    const ownArrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    return {
        status,
        ok: status >= 200 && status < 300,
        headers,
        arrayBuffer: vi.fn().mockResolvedValue(ownArrayBuffer),
    } as unknown as Response
}

describe('imageFetchInputSchema', () => {
    it(`rejects > ${IMAGE_FETCH_MAX_SOURCES} sources`, () => {
        const sources = Array.from({ length: IMAGE_FETCH_MAX_SOURCES + 1 }, () => ({ url: 'https://example.com/x.png' }))
        const r = imageFetchInputSchema.safeParse({ sources })
        expect(r.success).toBe(false)
    })

    it('rejects item with both url and imageId', () => {
        const r = imageFetchInputSchema.safeParse({
            sources: [{ url: 'https://a.com/p.png', imageId: 'abc' }],
        })
        expect(r.success).toBe(false)
    })

    it('rejects item with neither url nor imageId', () => {
        const r = imageFetchInputSchema.safeParse({
            sources: [{}],
        })
        expect(r.success).toBe(false)
    })
})

describe('createImageFetchTool - url sources', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
        createImageSeq = 0
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('returns items for single url PNG', async () => {
        vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse({ contentType: 'image/png', body: pngMagic }))

        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await execImageFetch(t, { sources: [{ url: 'https://example.com/img.png' }] })

        expect(result.items).toHaveLength(1)
        expect(result.items[0]).toMatchObject({ index: 0, ok: true, mimeType: 'image/png' })
        expect(result.items[0].ok && result.items[0].imageId).toBeTruthy()
        expect(result.notice).toMatch(/紧随其后的一条 role=user/)
        expect(result.notice).toMatch(/请先不要/)
    })

    it('returns items in order for multiple urls', async () => {
        vi.mocked(globalThis.fetch)
            .mockResolvedValueOnce(makeResponse({ contentType: 'image/png', body: pngMagic }))
            .mockResolvedValueOnce(makeResponse({ contentType: 'image/jpeg', body: jpegMagic }))

        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await execImageFetch(t, {
            sources: [
                { url: 'https://example.com/a.png' },
                { url: 'https://example.com/b.jpg' },
            ],
        })

        expect(result.items).toHaveLength(2)
        expect(result.items[0]).toMatchObject({ index: 0, ok: true, mimeType: 'image/png' })
        expect(result.items[1]).toMatchObject({ index: 1, ok: true, mimeType: 'image/jpeg' })
        expect(result.notice).toMatch(/共有 2 项 sources 成功/)
    })

    it('partial failure: first item ok, second SSRF error becomes ok:false item', async () => {
        vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse({ contentType: 'image/png', body: pngMagic }))

        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await execImageFetch(t, {
            sources: [
                { url: 'https://example.com/good.png' },
                { url: 'https://192.168.1.1/bad.png' },
            ],
        })

        expect(result.items[0]).toMatchObject({ index: 0, ok: true })
        expect(result.items[1]).toMatchObject({ index: 1, ok: false })
        expect(String((result.items[1] as { error: string }).error)).toMatch(/private network|192/i)
        expect(result.notice).toMatch(/共有 1 项 sources 成功/)
    })

    it('MIME error on item returns ok:false instead of throwing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
            makeResponse({ contentType: 'text/html', body: htmlBytes }),
        ))
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await execImageFetch(t, { sources: [{ url: 'https://example.com/page' }] })
        expect(result.items).toHaveLength(1)
        expect(result.items[0]).toMatchObject({ index: 0, ok: false })
        expect((result.items[0] as { error: string }).error).toMatch(/not an image MIME/)
        expect(result.notice).toMatch(/没有任何成功/)
    })
})

describe('createImageFetchTool - imageId sources', () => {
    beforeEach(() => {
        createImageSeq = 0
        vi.clearAllMocks()
    })

    it('resolves imageId in same conversation', async () => {
        const { readImageBuffer } = await import('../../lib/images/storage')
        vi.mocked(readImageBuffer).mockResolvedValueOnce(pngMagic)
        const images = await import('../../lib/db/images')
        vi.mocked(images.getImage).mockResolvedValueOnce({
            id: 'gen-1',
            conversationId: 'conv-1',
            mimeType: 'image/png',
            sizeBytes: 100,
        } as never)

        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await execImageFetch(t, { sources: [{ imageId: 'gen-1' }] })

        expect(result.items).toHaveLength(1)
        expect(result.items[0]).toEqual({
            index: 0,
            ok: true,
            imageId: 'gen-1',
            mimeType: 'image/png',
            sizeBytes: 100,
        })
        expect(images.createImage).not.toHaveBeenCalled()
        expect(result.notice).toMatch(/共有 1 项/)
    })

    it('wrong conversation imageId returns ok:false', async () => {
        const images = await import('../../lib/db/images')
        vi.mocked(images.getImage).mockResolvedValueOnce({
            id: 'x',
            conversationId: 'other',
            mimeType: 'image/png',
            sizeBytes: 1,
        } as never)

        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await execImageFetch(t, { sources: [{ imageId: 'x' }] })

        expect(result.items[0]).toMatchObject({ index: 0, ok: false })
        expect((result.items[0] as { error: string }).error).toMatch(/不属于当前会话/)
        expect(result.notice).toMatch(/没有任何成功/)
    })
})

describe('createImageFetchTool - redirect / size', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('redirect chain too long → ok:false item', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            makeResponse({ status: 302, location: 'https://a.com/img.png', contentType: '' }),
        ))
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await execImageFetch(t, { sources: [{ url: 'https://a.com/start.png' }] })
        expect(result.items[0]).toMatchObject({ ok: false })
        expect((result.items[0] as { error: string }).error).toMatch(/too many redirects/)
    })

    it('body too large → ok:false item', async () => {
        const largeBody = Buffer.alloc(11 * 1024 * 1024)
        pngMagic.copy(largeBody)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
            makeResponse({ contentType: 'image/png', body: largeBody }),
        ))
        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-1' })
        const result = await execImageFetch(t, { sources: [{ url: 'https://example.com/huge.png' }] })
        expect(result.items[0]).toMatchObject({ ok: false })
        expect((result.items[0] as { error: string }).error).toMatch(/too large/)
    })
})

describe('createImageFetchTool - mixed url + imageId', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
        createImageSeq = 0
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('runs url then imageId in sequence', async () => {
        vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse({ contentType: 'image/png', body: pngMagic }))

        const { readImageBuffer } = await import('../../lib/images/storage')
        vi.mocked(readImageBuffer).mockResolvedValueOnce(jpegMagic)
        const images = await import('../../lib/db/images')
        vi.mocked(images.getImage).mockResolvedValueOnce({
            id: 'existing-1',
            conversationId: 'conv-9',
            mimeType: 'image/jpeg',
            sizeBytes: 50,
        } as never)

        const { createImageFetchTool } = await import('../../lib/tools/image-fetch')
        const t = createImageFetchTool({ prisma: makePrisma(), conversationId: 'conv-9' })
        const result = await execImageFetch(t, {
            sources: [
                { url: 'https://example.com/f.png' },
                { imageId: 'existing-1' },
            ],
        })

        expect(result.items[0].ok).toBe(true)
        expect(result.items[1]).toMatchObject({
            index: 1,
            ok: true,
            imageId: 'existing-1',
            mimeType: 'image/jpeg',
        })
    })
})
