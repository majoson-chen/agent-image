import type { PrismaClient } from '../../../generated/prisma/client'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createLlmModel, createSearchModel, listModels } from '../../../lib/db/models'
import prismaDefault from '../../../lib/prisma'
import { llmModelInputSchema } from '../../../lib/validation/llm-model-schema'
import { searchModelInputSchema } from '../../../lib/validation/search-model-schema'

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

    const bodyType = (body as Record<string, unknown>)?.type

    try {
        if (bodyType === 'SEARCH') {
            const parsed = searchModelInputSchema.parse(body)
            const model = await createSearchModel(db, parsed)
            return NextResponse.json(model, { status: 201 })
        }
        // 默认 LLM（向后兼容旧请求不带 type 字段）
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
