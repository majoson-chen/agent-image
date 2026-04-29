import type { PrismaClient } from '../../../../generated/prisma/client'
import type { LlmModelInput } from '../../../../lib/validation/llm-model-schema'
import { NextResponse } from 'next/server'
import { deleteModel, getModel, updateLlmModel, updateSearchModel } from '../../../../lib/db/models'
import prismaDefault from '../../../../lib/prisma'

interface RouteContext { params: Promise<{ id: string }>, prisma?: PrismaClient }

export async function DELETE(_req: Request, { params, prisma }: RouteContext) {
    const { id } = await params
    const db = prisma ?? prismaDefault
    try {
        await deleteModel(db, id)
        return new Response(null, { status: 204 })
    }
    catch (e: any) {
        if (e?.code === 'P2025')
            return NextResponse.json({ error: '未找到' }, { status: 404 })
        throw e
    }
}

export async function PATCH(req: Request, { params, prisma }: RouteContext) {
    const { id } = await params
    const db = prisma ?? prismaDefault
    let body: Partial<LlmModelInput>
    try {
        body = await req.json()
    }
    catch {
        return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
    }

    const existing = await getModel(db, id)
    if (!existing)
        return NextResponse.json({ error: '未找到' }, { status: 404 })

    if (existing.type === 'SEARCH') {
        const model = await updateSearchModel(db, id, body as { name?: string, apiKey?: string })
        return NextResponse.json(model)
    }

    const model = await updateLlmModel(db, id, body)
    return NextResponse.json(model)
}
