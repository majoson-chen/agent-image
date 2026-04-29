import type { PrismaClient, SearchTool } from '~/generated/prisma/client'
import { getModel } from '@lib/db/models'
import { clearBinding, getAllBindings, setBinding } from '@lib/db/search-tool-bindings'
import prismaDefault from '@lib/prisma'
import { NextResponse } from 'next/server'

export interface BindingsRouteDeps {
    prisma?: PrismaClient
}

const VALID_TOOLS: SearchTool[] = ['WEB_SEARCH', 'IMAGE_SEARCH']

export async function handleBindingsGet(deps: BindingsRouteDeps = {}) {
    const db = deps.prisma ?? prismaDefault
    const bindings = await getAllBindings(db)
    return NextResponse.json(bindings)
}

export async function GET() {
    return handleBindingsGet()
}

export async function handleBindingsPut(req: Request, deps: BindingsRouteDeps = {}) {
    const db = deps.prisma ?? prismaDefault
    let body: unknown
    try {
        body = await req.json()
    }
    catch {
        return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
    }

    const { tool, modelId } = body as { tool?: unknown, modelId?: unknown }

    if (!tool || !VALID_TOOLS.includes(tool as SearchTool))
        return NextResponse.json({ error: `tool 必须为 ${VALID_TOOLS.join(' 或 ')}` }, { status: 422 })
    if (!modelId || typeof modelId !== 'string')
        return NextResponse.json({ error: 'modelId 必须为字符串' }, { status: 422 })

    const model = await getModel(db, modelId)
    if (!model || model.type !== 'SEARCH')
        return NextResponse.json({ error: '目标 model 不存在或不是 SEARCH 类型' }, { status: 422 })

    await setBinding(db, tool as SearchTool, modelId)
    return NextResponse.json({ tool, modelId })
}

export async function PUT(req: Request) {
    return handleBindingsPut(req)
}

export async function handleBindingsDelete(req: Request, deps: BindingsRouteDeps = {}) {
    const db = deps.prisma ?? prismaDefault
    const url = new URL(req.url)
    const tool = url.searchParams.get('tool') as SearchTool | null

    if (!tool || !VALID_TOOLS.includes(tool))
        return NextResponse.json({ error: `tool 查询参数必须为 ${VALID_TOOLS.join(' 或 ')}` }, { status: 422 })

    await clearBinding(db, tool)
    return NextResponse.json({ cleared: tool })
}

export async function DELETE(req: Request) {
    return handleBindingsDelete(req)
}
