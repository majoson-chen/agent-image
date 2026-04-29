import type { PrismaClient } from '../../../generated/prisma/client'
import { NextResponse } from 'next/server'
import { createConversation, listConversations } from '../../../lib/db/conversations'
import prismaDefault from '../../../lib/prisma'

interface RouteContext { prisma?: PrismaClient }

export async function GET(_req: Request = new Request(''), ctx: RouteContext = {}) {
    const db = ctx.prisma ?? prismaDefault
    const list = await listConversations(db)
    return NextResponse.json(list)
}

export async function POST(_req: Request = new Request(''), ctx: RouteContext = {}) {
    const db = ctx.prisma ?? prismaDefault
    const conv = await createConversation(db)
    return NextResponse.json(conv, { status: 201 })
}
