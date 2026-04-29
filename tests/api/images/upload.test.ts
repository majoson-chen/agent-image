/**
 * @vitest-environment node
 * Request.formData() 依赖 Node Undici；在默认 jsdom 环境下会与 FormData 组合解析失败。
 */
import type { PrismaClient } from '../../../generated/prisma/client'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { handleImagesPost } from '../../../app/api/images/route'
import { createConversation } from '../../../lib/db/conversations'
import { createTestDb } from '../../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>
let tmpDir: string

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-api-images-test-'))
    process.env.DATA_IMAGES_ROOT = tmpDir
})
afterEach(async () => {
    delete process.env.DATA_IMAGES_ROOT
    await fs.rm(tmpDir, { recursive: true, force: true })
})

afterAll(() => cleanup())

const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00])
const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00, 0x00, 0x10])

function makeRequest(file: File | null, conversationId?: string): Request {
    const form = new FormData()
    if (file)
        form.append('file', file)
    if (conversationId !== undefined)
        form.append('conversationId', conversationId)
    return new Request('http://localhost/api/images', { method: 'POST', body: form })
}

describe('pOST /api/images', () => {
    it('uploads a PNG and returns imageId', async () => {
        const conv = await createConversation(prisma)
        const file = new File([pngBuffer], 'test.png', { type: 'image/png' })
        const req = makeRequest(file, conv.id)
        const res = await handleImagesPost(req, { prisma })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.id).toBeTruthy()
        expect(body.mimeType).toBe('image/png')
        expect(body.sizeBytes).toBe(pngBuffer.length)
    })

    it('uploads a JPEG', async () => {
        const conv = await createConversation(prisma)
        const file = new File([jpegBuffer], 'test.jpg', { type: 'image/jpeg' })
        const res = await handleImagesPost(makeRequest(file, conv.id), { prisma })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.mimeType).toBe('image/jpeg')
    })

    it('returns 400 when no conversationId', async () => {
        const file = new File([pngBuffer], 'test.png', { type: 'image/png' })
        const res = await handleImagesPost(makeRequest(file), { prisma })
        expect(res.status).toBe(400)
    })

    it('returns 400 for non-existent conversation', async () => {
        const file = new File([pngBuffer], 'test.png', { type: 'image/png' })
        const res = await handleImagesPost(makeRequest(file, 'non-existent-conv-id'), { prisma })
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/对话不存在/)
    })

    it('returns 400 for 0-byte file', async () => {
        const conv = await createConversation(prisma)
        const file = new File([], 'empty.png', { type: 'image/png' })
        const res = await handleImagesPost(makeRequest(file, conv.id), { prisma })
        expect(res.status).toBe(400)
    })

    it('returns 413 for file over 20MB', async () => {
        const conv = await createConversation(prisma)
        // 模拟大文件：通过直接构造 FormData，不实际分配 21MB
        // 用 mock file
        const bigBuffer = Buffer.alloc(21 * 1024 * 1024, 0x89) // 21MB
        const bigFile = new File([bigBuffer], 'big.png', { type: 'image/png' })
        const res = await handleImagesPost(makeRequest(bigFile, conv.id), { prisma })
        expect(res.status).toBe(413)
    })

    it('returns 400 for SVG (disallowed type)', async () => {
        const conv = await createConversation(prisma)
        // SVG 内容不匹配任何 magic bytes → detectMime 返回 null
        const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
        const file = new File([svgBuffer], 'test.svg', { type: 'image/svg+xml' })
        const res = await handleImagesPost(makeRequest(file, conv.id), { prisma })
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/不支持的图像类型/)
    })
})
