import type { PrismaClient } from '~/generated/prisma/client'
import { deleteConversation, renameConversation } from '@lib/db/conversations'
import prismaDefault from '@lib/prisma'
import { parseConversationTitle } from '@lib/validation/conversation-title'
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

export async function handlePatchConversation(
    req: Request,
    paramsPromise: Promise<{ id: string }>,
    deps: ConversationByIdRouteDeps = {},
) {
    const { id } = await paramsPromise
    const db = deps.prisma ?? prismaDefault
    let raw: unknown
    try {
        raw = await req.json()
    }
    catch {
        return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
    }

    const body = raw as { title?: unknown }
    const parsed = parseConversationTitle(body.title)
    if (!parsed.ok)
        return NextResponse.json({ error: parsed.message }, { status: 422 })

    try {
        await renameConversation(db, id, parsed.title)
    }
    catch (e: unknown) {
        const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined
        if (code === 'P2025')
            return NextResponse.json({ error: '未找到' }, { status: 404 })
        throw e
    }

    return NextResponse.json({ id, title: parsed.title })
}

export async function PATCH(
    req: Request,
    segmentContext: { params: Promise<{ id: string }> },
) {
    return handlePatchConversation(req, segmentContext.params)
}

export async function DELETE(
    _req: Request,
    segmentContext: { params: Promise<{ id: string }> },
) {
    return handleDeleteConversation(segmentContext.params)
}
