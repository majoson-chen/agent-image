import type { PrismaClient } from '~/generated/prisma/client'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createConversation } from '@lib/db/conversations'
import { createImage } from '@lib/db/images'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { handleGetImage } from '@/api/images/[id]/route'
import { createTestDb } from '../../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>
let tmpDir: string

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-api-get-test-'))
    process.env.DATA_IMAGES_ROOT = tmpDir
})
afterEach(async () => {
    delete process.env.DATA_IMAGES_ROOT
    await fs.rm(tmpDir, { recursive: true, force: true })
})

afterAll(() => cleanup())

const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00])

describe('gET /api/images/[id]', () => {
    it('returns image bytes and correct headers', async () => {
        const conv = await createConversation(prisma)
        const img = await createImage(prisma, {
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            buffer: pngBuffer,
        })

        const res = await handleGetImage(Promise.resolve({ id: img.id }), { prisma })

        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('image/png')
        expect(res.headers.get('Cache-Control')).toContain('immutable')

        const buf = Buffer.from(await res.arrayBuffer())
        expect(buf).toEqual(pngBuffer)
    })

    it('returns 404 for non-existent imageId', async () => {
        const res = await handleGetImage(Promise.resolve({ id: 'non-existent' }), { prisma })
        expect(res.status).toBe(404)
    })
})
