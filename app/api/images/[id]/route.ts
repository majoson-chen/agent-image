import type { Buffer } from 'node:buffer'
import type { PrismaClient } from '~/generated/prisma/client'
import { getImage } from '@lib/db/images'
import { readImageBuffer } from '@lib/images/storage'
import prismaDefault from '@lib/prisma'
import { NextResponse } from 'next/server'

export interface ImageByIdRouteDeps {
    prisma?: PrismaClient
}

export async function handleGetImage(
    paramsPromise: Promise<{ id: string }>,
    deps: ImageByIdRouteDeps = {},
) {
    const db = deps.prisma ?? prismaDefault
    const { id } = await paramsPromise

    const image = await getImage(db, id)
    if (!image)
        return NextResponse.json({ error: '图像不存在' }, { status: 404 })

    let buffer: Buffer
    try {
        buffer = await readImageBuffer(image.conversationId, image.id, image.mimeType)
    }
    catch {
        return NextResponse.json({ error: '图像文件不存在' }, { status: 404 })
    }

    return new Response(new Uint8Array(buffer), {
        headers: {
            'Content-Type': image.mimeType,
            'Cache-Control': 'private, max-age=31536000, immutable',
        },
    })
}

export async function GET(
    _req: Request,
    segmentContext: { params: Promise<{ id: string }> },
) {
    return handleGetImage(segmentContext.params)
}
