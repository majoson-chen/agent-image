import { createReadStream } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { mimeToExt } from './mime'
import 'server-only'

function getRoot(): string {
    return process.env.DATA_IMAGES_ROOT ?? path.join(process.cwd(), 'data', 'images')
}

export function imagePath(conversationId: string, imageId: string, mimeType: string): string {
    const ext = mimeToExt(mimeType)
    return path.join(getRoot(), conversationId, `${imageId}${ext}`)
}

export async function writeImage(
    conversationId: string,
    imageId: string,
    mimeType: string,
    buffer: Buffer,
): Promise<void> {
    const p = imagePath(conversationId, imageId, mimeType)
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.writeFile(p, buffer)
}

export async function readImageBuffer(
    conversationId: string,
    imageId: string,
    mimeType: string,
): Promise<Buffer> {
    const p = imagePath(conversationId, imageId, mimeType)
    return fs.readFile(p)
}

export function readImageStream(conversationId: string, imageId: string, mimeType: string) {
    const p = imagePath(conversationId, imageId, mimeType)
    return createReadStream(p)
}

export async function deleteImage(
    conversationId: string,
    imageId: string,
    mimeType: string,
): Promise<void> {
    const p = imagePath(conversationId, imageId, mimeType)
    await fs.unlink(p).catch((e: NodeJS.ErrnoException) => {
        if (e.code !== 'ENOENT')
            throw e
    })
}

export async function deleteConversationImages(conversationId: string): Promise<void> {
    const dir = path.join(getRoot(), conversationId)
    await fs.rm(dir, { recursive: true, force: true }).catch((e: Error) => {
        console.error('deleteConversationImages failed:', e.message)
    })
}
