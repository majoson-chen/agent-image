import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// storage.ts 使用 DATA_IMAGES_ROOT 环境变量，测试中用 tmpDir 覆盖
let tmpDir: string

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-storage-test-'))
    process.env.DATA_IMAGES_ROOT = tmpDir
})

afterEach(async () => {
    delete process.env.DATA_IMAGES_ROOT
    await fs.rm(tmpDir, { recursive: true, force: true })
})

// 动态 import 确保环境变量已设
async function getStorage() {
    const mod = await import('../../lib/images/storage')
    return mod
}

describe('writeImage + readImageBuffer', () => {
    it('writes a file and reads back the same bytes', async () => {
        const { writeImage, readImageBuffer } = await getStorage()
        const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        await writeImage('conv1', 'img1', 'image/png', buffer)

        const result = await readImageBuffer('conv1', 'img1', 'image/png')
        expect(result).toEqual(buffer)
    })
})

describe('deleteImage', () => {
    it('deletes an existing image file', async () => {
        const { writeImage, deleteImage, imagePath } = await getStorage()
        const buffer = Buffer.from([0x42, 0x4D])
        await writeImage('conv2', 'img2', 'image/bmp', buffer)

        await deleteImage('conv2', 'img2', 'image/bmp')
        const p = imagePath('conv2', 'img2', 'image/bmp')
        await expect(fs.access(p)).rejects.toThrow()
    })

    it('does not throw when file does not exist', async () => {
        const { deleteImage } = await getStorage()
        await expect(deleteImage('conv-missing', 'img-missing', 'image/png')).resolves.toBeUndefined()
    })
})

describe('deleteConversationImages', () => {
    it('removes the entire conversation directory', async () => {
        const { writeImage, deleteConversationImages } = await getStorage()
        await writeImage('conv3', 'img3a', 'image/png', Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
        await writeImage('conv3', 'img3b', 'image/jpeg', Buffer.from([0xFF, 0xD8, 0xFF]))

        await deleteConversationImages('conv3')
        await expect(fs.access(path.join(tmpDir, 'conv3'))).rejects.toThrow()
    })

    it('does not throw when directory does not exist', async () => {
        const { deleteConversationImages } = await getStorage()
        await expect(deleteConversationImages('no-such-conv')).resolves.toBeUndefined()
    })
})
