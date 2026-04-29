import type { PrismaClient } from '../../../generated/prisma/client'
import { NextResponse } from 'next/server'
import { getConversation } from '../../../lib/db/conversations'
import { createImage } from '../../../lib/db/images'
import { detectMime, isAllowedMime } from '../../../lib/images/mime'
import prismaDefault from '../../../lib/prisma'
import { MAX_UPLOAD_BYTES } from '../../../lib/validation/image-upload-schema'

interface RouteContext {
    prisma?: PrismaClient
}

export async function POST(req: Request, ctx: RouteContext = {}) {
    const db = ctx.prisma ?? prismaDefault

    let formData: FormData
    try {
        formData = await req.formData()
    }
    catch {
        return NextResponse.json({ error: 'FormData 解析失败' }, { status: 400 })
    }

    const file = formData.get('file')
    const conversationId = formData.get('conversationId')

    if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim())
        return NextResponse.json({ error: 'conversationId 必填' }, { status: 400 })

    if (!(file instanceof File))
        return NextResponse.json({ error: '缺少文件' }, { status: 400 })

    if (file.size === 0)
        return NextResponse.json({ error: '文件为空' }, { status: 400 })

    if (file.size > MAX_UPLOAD_BYTES)
        return NextResponse.json({ error: '文件过大，最大 20MB' }, { status: 413 })

    const conv = await getConversation(db, conversationId)
    if (!conv)
        return NextResponse.json({ error: '对话不存在' }, { status: 400 })

    const arrayBuf = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)

    // 服务端 magic bytes 探测，防止 client 伪造
    const detectedMime = detectMime(buffer)
    if (!detectedMime || !isAllowedMime(detectedMime))
        return NextResponse.json({ error: '不支持的图像类型' }, { status: 400 })

    try {
        const image = await createImage(db, {
            conversationId,
            source: 'USER_UPLOAD',
            mimeType: detectedMime,
            sizeBytes: buffer.length,
            buffer,
        })
        return NextResponse.json({
            id: image.id,
            mimeType: image.mimeType,
            sizeBytes: image.sizeBytes,
            width: image.width,
            height: image.height,
        })
    }
    catch (e) {
        console.error('createImage failed:', e)
        return NextResponse.json({ error: '上传失败' }, { status: 500 })
    }
}
