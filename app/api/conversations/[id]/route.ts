import type { PrismaClient } from '~/generated/prisma/client'
import { deleteConversation } from '@lib/db/conversations'
import prismaDefault from '@lib/prisma'
import { NextResponse } from 'next/server'

export interface ConversationByIdRouteDeps {
    prisma?: PrismaClient
}

export async function handleDeleteConversation(
    paramsPromise: Promise<{ id: string }>,
    deps: ConversationByIdRouteDeps = {},
) {
    const { id } = await paramsPromise
    const db = deps.prisma ?? prismaDefault
    try {
        await deleteConversation(db, id)
        return new Response(null, { status: 204 })
    }
    catch (e: unknown) {
        const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined
        if (code === 'P2025')
            return NextResponse.json({ error: '未找到' }, { status: 404 })
        throw e
    }
}

export async function DELETE(
    _req: Request,
    segmentContext: { params: Promise<{ id: string }> },
) {
    return handleDeleteConversation(segmentContext.params)
}
