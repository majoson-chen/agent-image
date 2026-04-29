/**
 * U7 — hydrate-images 单测（test-first）
 * 验证 image-ref UIMessage part → image bytes 的转换
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

async function makeConvAndImage(p: PrismaClient) {
    const conv = await p.conversation.create({ data: { title: 'hydrate-conv' } })
    // create image file
    const imageId = crypto.randomUUID()
    const convDir = path.join(tmpRoot, conv.id)
    await fs.mkdir(convDir, { recursive: true })
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // PNG magic
    await fs.writeFile(path.join(convDir, `${imageId}.png`), pngBuffer)
    const image = await p.image.create({
        data: {
            id: imageId,
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
        },
    })
    return { conv, image, pngBuffer }
}

describe('hydrateImagesForLLM', () => {
    it('converts image-ref part to image part with bytes', async () => {
        const { hydrateImagesForLLM } = await import('../../lib/ai/hydrate-images')
        const { image, pngBuffer } = await makeConvAndImage(prisma)

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
        expect(result[0].parts).toHaveLength(2)
        expect(result[0].parts[0]).toMatchObject({ type: 'text', text: 'see this' })
        const imagePart = result[0].parts[1] as { type: string, image: Buffer, mimeType: string }
        expect(imagePart.type).toBe('image')
        expect(imagePart.mimeType).toBe('image/png')
        expect(Buffer.isBuffer(imagePart.image) || imagePart.image instanceof Uint8Array).toBe(true)
        expect(Buffer.from(imagePart.image).subarray(0, 4)).toEqual(pngBuffer.subarray(0, 4))
    })

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
        expect(result[0].parts).toEqual(uiMessages[0].parts)
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
        expect(result[0].parts).toHaveLength(0)
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
