/**
 * hydrate-images 单测（含 U5 扩展：assistant 生图注入）
 * 验证 image-ref / tool-image-generate / tool-image-fetch 部分的注入行为
 */
import type { PrismaClient } from '../../generated/prisma/client'
import { Buffer } from 'node:buffer'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>
let tmpRoot: string

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hydrate-test-'))
    process.env.DATA_IMAGES_ROOT = tmpRoot
})

afterAll(async () => {
    await cleanup()
    await fs.rm(tmpRoot, { recursive: true, force: true })
    delete process.env.DATA_IMAGES_ROOT
})

const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

async function makeConvAndImage(
    p: PrismaClient,
    source: 'USER_UPLOAD' | 'GENERATED' | 'URL_FETCHED' = 'USER_UPLOAD',
    originalUrl?: string,
) {
    const conv = await p.conversation.create({ data: { title: 'hydrate-conv' } })
    const imageId = crypto.randomUUID()
    const convDir = path.join(tmpRoot, conv.id)
    await fs.mkdir(convDir, { recursive: true })
    await fs.writeFile(path.join(convDir, `${imageId}.png`), pngBuffer)
    const image = await p.image.create({
        data: {
            id: imageId,
            conversationId: conv.id,
            source,
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            originalUrl: originalUrl ?? null,
        },
    })
    return { conv, image }
}

describe('hydrateImagesForLLM - existing user image-ref behavior', () => {
    it('converts image-ref part to image part with bytes', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const { image } = await makeConvAndImage(prisma)

        const uiMessages = [
            {
                id: 'msg-1',
                role: 'user' as const,
                parts: [
                    { type: 'text', text: 'see this' },
                    { type: 'image-ref', imageId: image.id },
                ],
            },
        ]

        const result = await hydrateImagesForLLM(uiMessages, prisma)
        const row = result[0]!
        expect(row.parts).toHaveLength(2)
        expect(row.parts[0]).toMatchObject({ type: 'text', text: 'see this' })
        const imagePart = row.parts[1] as { type: string, image: Buffer | Uint8Array, mimeType: string }
        expect(imagePart.type).toBe('image')
        expect(imagePart.mimeType).toBe('image/png')
        const img = imagePart.image
        expect(Buffer.isBuffer(img) || (typeof img === 'object' && img !== null && img instanceof Uint8Array)).toBe(true)
        expect(Buffer.from(img as Uint8Array).subarray(0, 4)).toEqual(pngBuffer.subarray(0, 4))
    })
})

describe('hydrateImagesForLLM', () => {
    it('preserves non-image-ref parts unchanged', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const uiMessages = [
            {
                id: 'msg-2',
                role: 'user' as const,
                parts: [
                    { type: 'text', text: 'hello' },
                    { type: 'step-start' },
                ],
            },
        ]

        const result = await hydrateImagesForLLM(uiMessages, prisma)
        expect(result[0]!.parts).toEqual(uiMessages[0]!.parts)
    })

    it('skips image-ref with missing image (no throw)', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const uiMessages = [
            {
                id: 'msg-3',
                role: 'user' as const,
                parts: [
                    { type: 'image-ref', imageId: 'non-existent-id' },
                ],
            },
        ]

        const result = await hydrateImagesForLLM(uiMessages, prisma)
        // image-ref with missing image is skipped
        expect(result[0]!.parts).toHaveLength(0)
    })

    it('does not mutate original messages array', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const original = [
            {
                id: 'msg-4',
                role: 'user' as const,
                parts: [{ type: 'text', text: 'original' }],
            },
        ]
        const copy = JSON.parse(JSON.stringify(original))
        await hydrateImagesForLLM(original, prisma)
        expect(original).toEqual(copy)
    })
})

describe('hydrateImagesForLLM - U5 assistant image injection', () => {
    it('injects GENERATED image before last user message parts (AE1 happy path)', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const { conv, image } = await makeConvAndImage(prisma, 'GENERATED')

        const messages = [
            { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'generate' }] },
            {
                id: 'a1',
                role: 'assistant',
                parts: [
                    { type: 'step-start' },
                    {
                        type: 'tool-image-generate-primary',
                        state: 'output-available',
                        toolCallId: 'call-1',
                        input: { prompt: 'a cat' },
                        output: { imageId: image.id, mimeType: 'image/png', sizeBytes: 8 },
                    },
                ],
            },
            { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'check it' }] },
        ]

        const result = await hydrateImagesForLLM(messages as never, prisma)

        // 最后一条 user message (u2) 应有 3 个 parts: text prelude + image + original text
        const lastUser = result.find(m => m.id === 'u2')!
        expect(lastUser.parts.length).toBe(3)
        expect((lastUser.parts[0] as { type: string, text: string }).type).toBe('text')
        expect((lastUser.parts[0] as { text: string }).text).toContain('工具调用产出')
        expect((lastUser.parts[0] as { text: string }).text).toContain(image.id)
        expect((lastUser.parts[1] as { type: string }).type).toBe('image')
        expect((lastUser.parts[2] as { type: string, text: string }).text).toBe('check it')

        // 其他 message 不变
        expect(result.find(m => m.id === 'u1')!.parts.length).toBe(1)

        // suppress unused variable
        void conv
    })

    it('injects URL_FETCHED image with correct provenance text', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const { image } = await makeConvAndImage(prisma, 'URL_FETCHED', 'https://example.com/pic.png')

        const messages = [
            { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'fetch it' }] },
            {
                id: 'a1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-image-fetch',
                        state: 'output-available',
                        toolCallId: 'call-2',
                        input: { url: 'https://example.com/pic.png' },
                        output: { imageId: image.id, mimeType: 'image/png', sizeBytes: 8 },
                    },
                ],
            },
            { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'describe' }] },
        ]

        const result = await hydrateImagesForLLM(messages as never, prisma)
        const lastUser = result.find(m => m.id === 'u2')!
        const prelude = (lastUser.parts[0] as { text: string }).text
        expect(prelude).toContain('URL 抓取')
        expect(prelude).toContain('https://example.com/pic.png')
    })

    it('deduplicates: user image-ref not re-injected', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const { image } = await makeConvAndImage(prisma, 'USER_UPLOAD')

        const messages = [
            {
                id: 'u1',
                role: 'user',
                parts: [
                    { type: 'image-ref', imageId: image.id },
                    { type: 'text', text: 'look' },
                ],
            },
            {
                id: 'a1',
                role: 'assistant',
                parts: [{ type: 'text', text: 'nice' }],
            },
            { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'again' }] },
        ]

        const result = await hydrateImagesForLLM(messages as never, prisma)
        // u2 should NOT have injected parts since image is already referenced by user
        const lastUser = result.find(m => m.id === 'u2')!
        expect(lastUser.parts.length).toBe(1)
        expect((lastUser.parts[0] as { text: string }).text).toBe('again')
    })

    it('deduplicates: same imageId in multiple assistant parts → injected once', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const { image } = await makeConvAndImage(prisma, 'GENERATED')

        const messages = [
            {
                id: 'a1',
                role: 'assistant',
                parts: [
                    { type: 'tool-image-generate-primary', state: 'output-available', output: { imageId: image.id } },
                    { type: 'tool-image-generate-primary', state: 'output-available', output: { imageId: image.id } },
                ],
            },
            { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
        ]

        const result = await hydrateImagesForLLM(messages as never, prisma)
        const lastUser = result.find(m => m.id === 'u1')!
        // 1 text prelude + 1 image + original text = 3, NOT 5
        expect(lastUser.parts.length).toBe(3)
    })

    it('skips image when DB record missing (warn + skip, no throw)', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')

        const messages = [
            {
                id: 'a1',
                role: 'assistant',
                parts: [
                    { type: 'tool-image-generate-primary', state: 'output-available', output: { imageId: 'missing-id' } },
                ],
            },
            { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
        ]

        const result = await hydrateImagesForLLM(messages as never, prisma)
        const lastUser = result.find(m => m.id === 'u1')!
        // missing image skipped, original parts unchanged
        expect(lastUser.parts.length).toBe(1)
    })

    it('does not inject when no assistant images exist (no-op)', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')

        const messages = [
            { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
            { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'hello' }] },
            { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'bye' }] },
        ]

        const result = await hydrateImagesForLLM(messages as never, prisma)
        expect(result.find(m => m.id === 'u2')!.parts.length).toBe(1)
    })

    it('does not inject if no user messages in conversation', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const { image } = await makeConvAndImage(prisma, 'GENERATED')

        const messages = [
            {
                id: 'a1',
                role: 'assistant',
                parts: [
                    { type: 'tool-image-generate-primary', state: 'output-available', output: { imageId: image.id } },
                ],
            },
        ]

        // 没有 user message，注入无处安放，应不抛错
        const result = await hydrateImagesForLLM(messages as never, prisma)
        expect(result.length).toBe(1)
        expect(result[0]!.parts.length).toBe(1)
    })
})
