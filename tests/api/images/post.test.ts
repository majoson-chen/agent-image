/** FormData + Request multipart 在 jsdom 下解析异常，改用 node 环境 */
// @vitest-environment node

import type { PrismaClient } from '~/generated/prisma/client'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createConversation } from '@lib/db/conversations'
import { MAX_IMAGE_BYTES } from '@lib/image-upload-limits'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { handlePostImage } from '@/api/images/route'
import { createTestDb } from '../../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>
let tmpDir: string

const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00])

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-api-post-test-'))
    process.env.DATA_IMAGES_ROOT = tmpDir
})
afterEach(async () => {
    delete process.env.DATA_IMAGES_ROOT
    await fs.rm(tmpDir, { recursive: true, force: true })
})

afterAll(() => cleanup())

function postRequest(convId: string, file: File) {
    const form = new FormData()
    form.set('conversationId', convId)
    form.set('file', file)
    return new Request('http://localhost/api/images', { method: 'POST', body: form })
}

describe('handlePostImage', () => {
    it('creates USER_UPLOAD image and returns json', async () => {
        const conv = await createConversation(prisma)
        const req = postRequest(conv.id, new File([new Uint8Array(pngBuffer)], 't.png', { type: 'image/png' }))

        const res = await handlePostImage(req, { prisma })

        expect(res.status).toBe(200)
        const body = await res.json() as { id: string, mimeType: string, sizeBytes: number }
        expect(body.mimeType).toBe('image/png')
        expect(body.sizeBytes).toBe(pngBuffer.length)
        expect(typeof body.id).toBe('string')
        expect(body.id.length).toBeGreaterThan(10)

        const row = await prisma.image.findUnique({ where: { id: body.id } })
        expect(row?.source).toBe('USER_UPLOAD')
        expect(row?.conversationId).toBe(conv.id)
    })

    it('returns 404 when conversation does not exist', async () => {
        const req = postRequest('00000000-0000-4000-8000-000000000001', new File([new Uint8Array(pngBuffer)], 't.png', { type: 'image/png' }))
        const res = await handlePostImage(req, { prisma })
        expect(res.status).toBe(404)
    })

    it('returns 400 when file is not a valid image', async () => {
        const conv = await createConversation(prisma)
        const bad = new Uint8Array([0x00, 0x01, 0x02])
        const req = postRequest(conv.id, new File([bad], 'x.bin', { type: 'application/octet-stream' }))
        const res = await handlePostImage(req, { prisma })
        expect(res.status).toBe(400)
    })

    it('returns 413 when file exceeds max size', async () => {
        const conv = await createConversation(prisma)
        const big = new Uint8Array(MAX_IMAGE_BYTES + 1)
        big.set([0x89, 0x50, 0x4E, 0x47], 0)
        const req = postRequest(conv.id, new File([big], 'huge.png', { type: 'image/png' }))
        const res = await handlePostImage(req, { prisma })
        expect(res.status).toBe(413)
    })
})
