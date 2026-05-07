import type { PrismaClient } from '~/generated/prisma/client'
import { deleteModel, updateModel } from '@lib/db/models'
import prismaDefault from '@lib/prisma'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

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

    try {
        const model = await updateModel(db, id, body)
        if (!model)
            return NextResponse.json({ error: '未找到' }, { status: 404 })
        return NextResponse.json(model)
    }
    catch (e) {
        if (e instanceof ZodError)
            return NextResponse.json({ errors: e.issues }, { status: 422 })
        throw e
    }
}

export async function PATCH(
    req: Request,
    segmentContext: { params: Promise<{ id: string }> },
) {
    return handlePatchModel(req, segmentContext.params)
}
