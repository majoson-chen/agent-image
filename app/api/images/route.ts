import type { PrismaClient } from '~/generated/prisma/client'
import { createImage } from '@lib/db/images'
import { MAX_IMAGE_BYTES } from '@lib/image-upload-limits'
import { detectMime, isAllowedMime } from '@lib/images/mime'
import prismaDefault from '@lib/prisma'
import { NextResponse } from 'next/server'

export interface ImagePostRouteDeps {
    prisma?: PrismaClient
}

export async function handlePostImage(req: Request, deps: ImagePostRouteDeps = {}) {
    const db = deps.prisma ?? prismaDefault

    let form: FormData
    try {
        form = await req.formData()
    }
    catch {
        return NextResponse.json({ error: '无效表单' }, { status: 400 })
    }

    const conversationIdRaw = form.get('conversationId')
    const file = form.get('file')

    if (typeof conversationIdRaw !== 'string' || conversationIdRaw.length === 0) {
        return NextResponse.json({ error: '缺少 conversationId' }, { status: 400 })
    }

    if (!(file instanceof Blob)) {
        return NextResponse.json({ error: '缺少 file' }, { status: 400 })
    }

    const conv = await db.conversation.findUnique({ where: { id: conversationIdRaw } })
    if (!conv)
        return NextResponse.json({ error: '会话不存在' }, { status: 404 })

    const buf = Buffer.from(await file.arrayBuffer())

    if (buf.length > MAX_IMAGE_BYTES) {
        return NextResponse.json(
            { error: `文件过大（上限 ${MAX_IMAGE_BYTES} 字节）` },
            { status: 413 },
        )
    }

    const detected = detectMime(buf)
    if (!detected || !isAllowedMime(detected)) {
        return NextResponse.json({ error: '不支持的图像类型' }, { status: 400 })
    }

    const img = await createImage(db, {
        conversationId: conversationIdRaw,
        source: 'USER_UPLOAD',
        mimeType: detected,
        sizeBytes: buf.length,
        buffer: buf,
    })

    return NextResponse.json({
        id: img.id,
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
    })
}

export async function POST(req: Request) {
    return handlePostImage(req)
}
