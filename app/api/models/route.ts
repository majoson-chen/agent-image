import type { PrismaClient } from '~/generated/prisma/client'
import { createModel, listModels } from '@lib/db/models'
import prismaDefault from '@lib/prisma'
import { modelCreateBodySchema } from '@lib/validation/model-upsert-schema'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export interface ModelsRouteDeps {
    prisma?: PrismaClient
}

export async function handleModelsGet(deps: ModelsRouteDeps = {}) {
    const db = deps.prisma ?? prismaDefault
    const models = await listModels(db)
    return NextResponse.json(models)
}

export async function GET() {
    return handleModelsGet()
}

export async function handleModelsPost(req: Request, deps: ModelsRouteDeps = {}) {
    const db = deps.prisma ?? prismaDefault
    let body: unknown
    try {
        body = await req.json()
    }
    catch {
        return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
    }

    try {
        const parsed = modelCreateBodySchema.parse(body)
        const model = await createModel(db, parsed)
        return NextResponse.json(model, { status: 201 })
    }
    catch (e) {
        if (e instanceof ZodError)
            return NextResponse.json({ errors: e.issues }, { status: 422 })
        throw e
    }
}

export async function POST(req: Request) {
    return handleModelsPost(req)
}
