import type { PrismaClient } from '../../../generated/prisma/client'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createLlmModel, listModels } from '../../../lib/db/models'
import prismaDefault from '../../../lib/prisma'
import { llmModelInputSchema } from '../../../lib/validation/llm-model-schema'

interface RouteContext { prisma?: PrismaClient }

export async function GET(_req: Request = new Request(''), ctx: RouteContext = {}) {
    const db = ctx.prisma ?? prismaDefault
    const models = await listModels(db)
    return NextResponse.json(models)
}

export async function POST(req: Request, ctx: RouteContext = {}) {
    const db = ctx.prisma ?? prismaDefault
    let body: unknown
    try {
        body = await req.json()
    }
    catch {
        return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
    }

    try {
        const parsed = llmModelInputSchema.parse(body)
        const model = await createLlmModel(db, parsed)
        return NextResponse.json(model, { status: 201 })
    }
    catch (e) {
        if (e instanceof ZodError)
            return NextResponse.json({ errors: e.errors }, { status: 422 })
        throw e
    }
}
