import type { LlmModelInput } from '@lib/validation/llm-model-schema'
import type { PrismaClient } from '~/generated/prisma/client'
import { deleteModel, getModel, updateLlmModel, updateSearchModel } from '@lib/db/models'
import prismaDefault from '@lib/prisma'
import { NextResponse } from 'next/server'

export interface ModelByIdRouteDeps {
    prisma?: PrismaClient
}

export async function handleDeleteModel(
    paramsPromise: Promise<{ id: string }>,
    deps: ModelByIdRouteDeps = {},
) {
    const { id } = await paramsPromise
    const db = deps.prisma ?? prismaDefault
    try {
        await deleteModel(db, id)
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
    return handleDeleteModel(segmentContext.params)
}

export async function handlePatchModel(
    req: Request,
    paramsPromise: Promise<{ id: string }>,
    deps: ModelByIdRouteDeps = {},
) {
    const { id } = await paramsPromise
    const db = deps.prisma ?? prismaDefault
    let body: unknown
    try {
        body = await req.json()
    }
    catch {
        return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
    }

    const patch = body as Partial<LlmModelInput>

    const existing = await getModel(db, id)
    if (!existing)
        return NextResponse.json({ error: '未找到' }, { status: 404 })

    if (existing.type === 'SEARCH') {
        const model = await updateSearchModel(db, id, patch as { name?: string, apiKey?: string })
        return NextResponse.json(model)
    }

    const model = await updateLlmModel(db, id, patch)
    return NextResponse.json(model)
}

export async function PATCH(
    req: Request,
    segmentContext: { params: Promise<{ id: string }> },
) {
    return handlePatchModel(req, segmentContext.params)
}
