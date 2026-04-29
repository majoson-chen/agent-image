import type { PrismaClient } from '~/generated/prisma/client'
import { createConversation, listConversations } from '@lib/db/conversations'
import prismaDefault from '@lib/prisma'
import { NextResponse } from 'next/server'

export interface ConversationsRouteDeps {
    prisma?: PrismaClient
}

export async function handleConversationsGet(deps: ConversationsRouteDeps = {}) {
    const db = deps.prisma ?? prismaDefault
    const list = await listConversations(db)
    return NextResponse.json(list)
}

export async function GET() {
    return handleConversationsGet()
}

export async function handleConversationsPost(deps: ConversationsRouteDeps = {}) {
    const db = deps.prisma ?? prismaDefault
    const conv = await createConversation(db)
    return NextResponse.json(conv, { status: 201 })
}

export async function POST() {
    return handleConversationsPost()
}
