import type { PrismaClient } from '../../../../generated/prisma/client'
import { NextResponse } from 'next/server'
import { getImage } from '../../../../lib/db/images'
import { readImageBuffer } from '../../../../lib/images/storage'
import prismaDefault from '../../../../lib/prisma'

interface RouteContext {
    params: Promise<{ id: string }>
    prisma?: PrismaClient
}

export async function GET(_req: Request, ctx: RouteContext) {
    const db = ctx.prisma ?? prismaDefault
    const { id } = await ctx.params

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

    return new Response(buffer, {
        headers: {
            'Content-Type': image.mimeType,
            'Cache-Control': 'private, max-age=31536000, immutable',
        },
    })
}
