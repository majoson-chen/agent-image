import type { LanguageModelV1 } from 'ai'
import type { PrismaClient } from '../../../generated/prisma/client'
import { convertToModelMessages, streamText } from 'ai'
import { NextResponse } from 'next/server'
import { appendAssistantMessage, listMessages } from '../../../lib/db/messages'
import { getModel } from '../../../lib/db/models'
import { getSelection } from '../../../lib/db/selections'
import { buildLlmModel } from '../../../lib/llm-provider-factory'
import prismaDefault from '../../../lib/prisma'

interface RouteContext {
    prisma?: PrismaClient
    model?: LanguageModelV1
}

export async function POST(req: Request, ctx: RouteContext = {}) {
    const db = ctx.prisma ?? prismaDefault
    let body: { conversationId?: string }
    try {
        body = await req.json()
    }
    catch {
        return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
    }

    const { conversationId } = body
    if (!conversationId)
        return NextResponse.json({ error: 'conversationId 必填' }, { status: 400 })

    // 获取 LLM 选型
    const selection = await getSelection(db, conversationId, 'LLM')
    if (!selection)
        return NextResponse.json({ error: '请先选择 LLM 模型' }, { status: 400 })

    // 构建 LLM 模型实例（测试时由 ctx.model 注入）
    let llmModel: LanguageModelV1
    if (ctx.model) {
        llmModel = ctx.model
    }
    else {
        const modelRecord = await getModel(db, selection.modelId)
        if (!modelRecord)
            return NextResponse.json({ error: 'LLM 模型不存在' }, { status: 404 })
        llmModel = buildLlmModel(modelRecord)
    }

    // 获取消息历史
    const dbMessages = await listMessages(db, conversationId)
    const uiMessages = dbMessages.map(m => ({
        id: m.id,
        role: m.role.toLowerCase() as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: m.content }],
    }))

    const result = streamText({
        model: llmModel,
        messages: await convertToModelMessages(uiMessages),
        onFinish: async ({ totalUsage, text }) => {
            const inputTokens = totalUsage.inputTokens ?? null
            const outputTokens = totalUsage.outputTokens ?? null
            await appendAssistantMessage(
                db,
                conversationId,
                text,
                {
                    inputTokens,
                    outputTokens,
                    totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0) || null,
                },
                selection.modelId,
            )
        },
    })

    return result.toUIMessageStreamResponse({
        messageMetadata: ({ part }) => {
            if (part.type === 'finish') {
                const inp = part.totalUsage.inputTokens ?? 0
                const out = part.totalUsage.outputTokens ?? 0
                return {
                    usage: { inputTokens: inp, outputTokens: out, totalTokens: inp + out },
                }
            }
        },
    })
}
