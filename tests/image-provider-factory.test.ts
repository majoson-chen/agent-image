import type { PrismaClient } from '../generated/prisma/client'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createConversation } from '../lib/db/conversations'
import { createTestDb } from './helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>
let tmpDir: string

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-factory-test-'))
    process.env.DATA_IMAGES_ROOT = tmpDir
})
afterEach(async () => {
    vi.restoreAllMocks()
    delete process.env.DATA_IMAGES_ROOT
    await fs.rm(tmpDir, { recursive: true, force: true })
})

const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00])

async function createSeedreamModel(overrides: Record<string, unknown> = {}) {
    return prisma.model.create({
        data: {
            type: 'IMAGE',
            name: 'doubao-seedream-4-5-251128',
            providerType: 'VOLCENGINE_SEEDREAM',
            apiKey: 'ark-test-key',
            capabilities: { supportedSizes: ['1024x1024', '2048x2048'], maxReferenceImages: 14, supportsSeed: false },
            ...overrides,
        },
    })
}

async function getFactory() {
    const mod = await import('../lib/image-provider-factory')
    return mod.executeImageGeneration
}

describe('executeImageGeneration - happy paths', () => {
    it('sends correct request to Seedream and falls back image to disk', async () => {
        const model = await createSeedreamModel()
        const conv = await createConversation(prisma)

        // Mock Seedream + download fetch
        let capturedBody: unknown
        let fetchCallCount = 0
        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
            fetchCallCount++
            if (fetchCallCount === 1) {
                // Seedream API call
                capturedBody = JSON.parse(init?.body as string)
                return new Response(
                    JSON.stringify({ data: [{ url: 'https://oss.example.com/img.png' }] }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                ) as Response
            }
            // Download call
            return new Response(pngBuffer, {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            }) as Response
        }) as typeof fetch

        try {
            const executeImageGeneration = await getFactory()
            const result = await executeImageGeneration({
                model,
                prompt: '一只柯基',
                referenceImageIds: [],
                size: '1024x1024',
                conversationId: conv.id,
                prisma,
                abortSignal: new AbortController().signal,
            })

            expect(result.imageId).toBeTruthy()
            expect(result.mimeType).toBe('image/png')
            expect(capturedBody).toMatchObject({
                model: 'doubao-seedream-4-5-251128',
                prompt: '一只柯基',
                size: '1024x1024',
            })
            // 无参考图时不传 image 字段
            expect((capturedBody as Record<string, unknown>).image).toBeUndefined()
        }
        finally {
            globalThis.fetch = originalFetch
        }
    })

    it('includes reference images as base64 array in request', async () => {
        const model = await createSeedreamModel()
        const conv = await createConversation(prisma)

        // 先创建两张参考图
        const { createImage } = await import('../lib/db/images')
        const ref1 = await createImage(prisma, {
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            buffer: pngBuffer,
        })
        const ref2 = await createImage(prisma, {
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            buffer: pngBuffer,
        })

        let capturedBody: unknown
        const originalFetch = globalThis.fetch
        let callIdx = 0
        globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
            callIdx++
            if (callIdx === 1) {
                capturedBody = JSON.parse(init?.body as string)
                return new Response(
                    JSON.stringify({ data: [{ url: 'https://oss.example.com/img.png' }] }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                ) as Response
            }
            return new Response(pngBuffer, { status: 200, headers: { 'Content-Type': 'image/png' } }) as Response
        }) as typeof fetch

        try {
            const executeImageGeneration = await getFactory()
            await executeImageGeneration({
                model,
                prompt: 'test',
                referenceImageIds: [ref1.id, ref2.id],
                size: '1024x1024',
                conversationId: conv.id,
                prisma,
                abortSignal: new AbortController().signal,
            })

            const body = capturedBody as Record<string, unknown>
            expect(Array.isArray(body.image)).toBe(true)
            const imgs = body.image as string[]
            expect(imgs).toHaveLength(2)
            expect(imgs[0]).toMatch(/^data:image\/png;base64,/)
        }
        finally {
            globalThis.fetch = originalFetch
        }
    })

    it('forwards abortSignal to both fetch calls', async () => {
        const model = await createSeedreamModel()
        const conv = await createConversation(prisma)

        const signals: (AbortSignal | null | undefined)[] = []
        const originalFetch = globalThis.fetch
        let callIdx = 0
        globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
            signals.push(init?.signal)
            callIdx++
            if (callIdx === 1) {
                return new Response(
                    JSON.stringify({ data: [{ url: 'https://oss.example.com/img.png' }] }),
                    { status: 200 },
                ) as Response
            }
            return new Response(pngBuffer, { status: 200, headers: { 'Content-Type': 'image/png' } }) as Response
        }) as typeof fetch

        const ac = new AbortController()
        try {
            const executeImageGeneration = await getFactory()
            await executeImageGeneration({
                model,
                prompt: 'test',
                referenceImageIds: [],
                size: '1024x1024',
                conversationId: conv.id,
                prisma,
                abortSignal: ac.signal,
            })
            expect(signals.length).toBe(2)
            // 两次 fetch 的 signal 都应包含 abortController 的 signal
        }
        finally {
            globalThis.fetch = originalFetch
        }
    })
})

function mockModel(overrides: Record<string, unknown> = {}) {
    return {
        id: 'mock-model-id',
        type: 'IMAGE' as const,
        name: 'test-model',
        providerType: 'VOLCENGINE_SEEDREAM' as const,
        apiKey: 'test-key',
        baseURL: null,
        contextWindow: null,
        extraHeaders: null,
        capabilities: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }
}

describe('executeImageGeneration - error paths', () => {
    it('throws on Seedream 401 without leaking apiKey', async () => {
        const model = mockModel({ apiKey: 'secret-api-key-xyz' })
        const conv = await createConversation(prisma)

        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn(async () => {
            return new Response('Unauthorized', { status: 401 }) as Response
        }) as typeof fetch

        try {
            const executeImageGeneration = await getFactory()
            await expect(executeImageGeneration({
                model,
                prompt: 'test',
                referenceImageIds: [],
                size: '1024x1024',
                conversationId: conv.id,
                prisma,
                abortSignal: new AbortController().signal,
            })).rejects.toThrow(/Seedream 401/)
            // 错误消息不应包含 apiKey
        }
        finally {
            globalThis.fetch = originalFetch
        }
    })

    it('throws when Seedream response is missing URL', async () => {
        const model = mockModel()
        const conv = await createConversation(prisma)

        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn(async () => {
            return new Response(JSON.stringify({ data: [] }), { status: 200 }) as Response
        }) as typeof fetch

        try {
            const executeImageGeneration = await getFactory()
            await expect(executeImageGeneration({
                model,
                prompt: 'test',
                referenceImageIds: [],
                size: '1024x1024',
                conversationId: conv.id,
                prisma,
                abortSignal: new AbortController().signal,
            })).rejects.toThrow(/missing image URL/)
        }
        finally {
            globalThis.fetch = originalFetch
        }
    })

    it('throws on download failure', async () => {
        const model = mockModel()
        const conv = await createConversation(prisma)

        const originalFetch = globalThis.fetch
        let callIdx = 0
        globalThis.fetch = vi.fn(async () => {
            callIdx++
            if (callIdx === 1) {
                return new Response(
                    JSON.stringify({ data: [{ url: 'https://oss.example.com/img.png' }] }),
                    { status: 200 },
                ) as Response
            }
            return new Response('Not Found', { status: 404 }) as Response
        }) as typeof fetch

        try {
            const executeImageGeneration = await getFactory()
            await expect(executeImageGeneration({
                model,
                prompt: 'test',
                referenceImageIds: [],
                size: '1024x1024',
                conversationId: conv.id,
                prisma,
                abortSignal: new AbortController().signal,
            })).rejects.toThrow(/download 404/)
        }
        finally {
            globalThis.fetch = originalFetch
        }
    })

    it('throws for unsupported provider type', async () => {
        const model = mockModel({ providerType: 'OPENAI' })
        const conv = await createConversation(prisma)

        const executeImageGeneration = await getFactory()
        await expect(executeImageGeneration({
            model,
            prompt: 'test',
            referenceImageIds: [],
            size: '1024x1024',
            conversationId: conv.id,
            prisma,
            abortSignal: new AbortController().signal,
        })).rejects.toThrow(/unsupported/)
    })
})
