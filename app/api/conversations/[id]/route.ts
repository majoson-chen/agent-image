import type { PrismaClient } from '../../../../generated/prisma/client'
import { NextResponse } from 'next/server'
import { deleteConversation } from '../../../../lib/db/conversations'
import prismaDefault from '../../../../lib/prisma'

interface RouteContext { params: Promise<{ id: string }>, prisma?: PrismaClient }

export async function DELETE(_req: Request, { params, prisma }: RouteContext) {
    const { id } = await params
    const db = prisma ?? prismaDefault
    try {
        await deleteConversation(db, id)
        return new Response(null, { status: 204 })
    }
    catch (e: any) {
        if (e?.code === 'P2025')
            return NextResponse.json({ error: '未找到' }, { status: 404 })
        throw e
    }
}
