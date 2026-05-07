/**
 * GET /api/register-metadata?type=LLM|IMAGE|SEARCH — 静态 Register 目录（可读元数据）。
 */
import { listRegisterMetadata } from '@lib/providers/registry'
import { NextResponse } from 'next/server'

export async function handleRegisterMetadataGet(searchParams: URLSearchParams) {
    const t = searchParams.get('type')
    if (t !== 'LLM' && t !== 'IMAGE' && t !== 'SEARCH')
        return NextResponse.json({ error: 'type 必须为 LLM | IMAGE | SEARCH' }, { status: 400 })
    const list = listRegisterMetadata(t).map(({ registerId, modelType, title, description, sortOrder }) => ({
        registerId,
        modelType,
        title,
        description: description ?? null,
        sortOrder,
    }))
    return NextResponse.json(list)
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    return handleRegisterMetadataGet(searchParams)
}
