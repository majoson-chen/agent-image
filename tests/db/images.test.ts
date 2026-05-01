import type { PrismaClient } from '~/generated/prisma/client'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>
let tmpDir: string

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-db-images-test-'))
    process.env.DATA_IMAGES_ROOT = tmpDir
})

afterEach(async () => {
    delete process.env.DATA_IMAGES_ROOT
    await fs.rm(tmpDir, { recursive: true, force: true })
})

afterAll(() => cleanup())

const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00])
const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00])

async function getCreateImage() {
    const { createImage } = await import('../../lib/db/images')
    return createImage
}

describe('createImage USER_UPLOAD', () => {
    it('creates DB row and writes file to disk', async () => {
        const createImage = await getCreateImage()
        const conv = await prisma.conversation.create({ data: {} })

        const img = await createImage(prisma, {
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            buffer: pngBuffer,
        })

        expect(img.id).toBeTruthy()
        expect(img.source).toBe('USER_UPLOAD')
        expect(img.mimeType).toBe('image/png')
        expect(img.modelIdAtTime).toBeNull()

        // 文件应落盘
        const filePath = path.join(tmpDir, conv.id, `${img.id}.png`)
        const fileBytes = await fs.readFile(filePath)
        expect(fileBytes).toEqual(pngBuffer)
    })
})

describe('createImage GENERATED', () => {
    it('creates DB row with modelIdAtTime', async () => {
        const createImage = await getCreateImage()
        const model = await prisma.model.create({
            data: { type: 'IMAGE', name: 'test-gen', providerType: 'VOLCENGINE_SEEDREAM', apiKey: 'k' },
        })
        const conv = await prisma.conversation.create({ data: {} })

        const img = await createImage(prisma, {
            conversationId: conv.id,
            source: 'GENERATED',
            mimeType: 'image/jpeg',
            sizeBytes: jpegBuffer.length,
            modelIdAtTime: model.id,
            buffer: jpegBuffer,
        })

        expect(img.source).toBe('GENERATED')
        expect(img.modelIdAtTime).toBe(model.id)
    })
})

describe('getImage', () => {
    it('returns image by id', async () => {
        const { createImage, getImage } = await import('../../lib/db/images')
        const conv = await prisma.conversation.create({ data: {} })
        const img = await createImage(prisma, {
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            buffer: pngBuffer,
        })

        const found = await getImage(prisma, img.id)
        expect(found?.id).toBe(img.id)
    })

    it('returns null for missing id', async () => {
        const { getImage } = await import('../../lib/db/images')
        expect(await getImage(prisma, 'non-existent-id')).toBeNull()
    })
})

describe('deleteImage', () => {
    it('removes DB row and file', async () => {
        const { createImage, deleteImage, getImage } = await import('../../lib/db/images')
        const conv = await prisma.conversation.create({ data: {} })
        const img = await createImage(prisma, {
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            buffer: pngBuffer,
        })

        await deleteImage(prisma, img.id)
        expect(await getImage(prisma, img.id)).toBeNull()

        // 文件应已删除
        const filePath = path.join(tmpDir, conv.id, `${img.id}.png`)
        await expect(fs.access(filePath)).rejects.toThrow()
    })
})

describe('listImages', () => {
    it('lists images for a conversation', async () => {
        const { createImage, listImages } = await import('../../lib/db/images')
        const conv = await prisma.conversation.create({ data: {} })
        await createImage(prisma, {
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            buffer: pngBuffer,
        })
        await createImage(prisma, {
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/jpeg',
            sizeBytes: jpegBuffer.length,
            buffer: jpegBuffer,
        })

        const images = await listImages(prisma, conv.id)
        expect(images).toHaveLength(2)
    })
})

describe('createImage URL_FETCHED', () => {
    it('creates DB row with source URL_FETCHED and originalUrl round-trips correctly', async () => {
        const createImage = await getCreateImage()
        const conv = await prisma.conversation.create({ data: {} })

        const img = await createImage(prisma, {
            conversationId: conv.id,
            source: 'URL_FETCHED',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            originalUrl: 'https://example.com/test.png',
            buffer: pngBuffer,
        })

        expect(img.source).toBe('URL_FETCHED')
        expect(img.originalUrl).toBe('https://example.com/test.png')
        expect(img.modelIdAtTime).toBeNull()
    })

    it('creates URL_FETCHED row without originalUrl (nullable)', async () => {
        const createImage = await getCreateImage()
        const conv = await prisma.conversation.create({ data: {} })

        const img = await createImage(prisma, {
            conversationId: conv.id,
            source: 'URL_FETCHED',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            buffer: pngBuffer,
        })

        expect(img.source).toBe('URL_FETCHED')
        expect(img.originalUrl).toBeNull()
    })
})

describe('createImage error paths', () => {
    it('does not create DB row when write fails', async () => {
        const { createImage, getImage } = await import('../../lib/db/images')
        const conv = await prisma.conversation.create({ data: {} })

        // 用无效路径触发写盘失败
        process.env.DATA_IMAGES_ROOT = '/root/no-permission-path-that-does-not-exist-xyz'

        let threw = false
        let imgId: string | undefined
        try {
            const img = await createImage(prisma, {
                conversationId: conv.id,
                source: 'USER_UPLOAD',
                mimeType: 'image/png',
                sizeBytes: pngBuffer.length,
                buffer: pngBuffer,
            })
            imgId = img.id
        }
        catch {
            threw = true
        }
        expect(threw).toBe(true)
        if (imgId) {
            expect(await getImage(prisma, imgId)).toBeNull()
        }

        // 恢复
        process.env.DATA_IMAGES_ROOT = tmpDir
    })
})
