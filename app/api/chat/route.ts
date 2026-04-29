import type { LanguageModelV1 } from 'ai'
import type { ToolSet } from 'ai'
import type { PrismaClient } from '../../../generated/prisma/client'
import { createAgentUIStreamResponse } from 'ai'
import { NextResponse } from 'next/server'
import { listMessages, upsertAssistantMessage } from '../../../lib/db/messages'
import { getModel } from '../../../lib/db/models'
import { getSelection } from '../../../lib/db/selections'
import { buildLlmModel } from '../../../lib/llm-provider-factory'
import { buildAgent } from '../../../lib/ai/build-agent'
import { buildSystemPrompt } from '../../../lib/ai/system-prompt'
import { appendStepToParts } from '../../../lib/ai/step-to-parts'
import { buildAvailableTools } from '../../../lib/tools/tool-registry'
import prismaDefault from '../../../lib/prisma'

interface RouteContext {
    prisma?: PrismaClient
    model?: LanguageModelV1
    toolsOverride?: ToolSet
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

    // 构建 LLM 模型实例
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

    // 获取消息历史，转为 UIMessage 格式
    const dbMessages = await listMessages(db, conversationId)
    const uiMessages = dbMessages.map((m) => {
        // M2 消息：直接用 parts；M1 旧消息：降级为 content text part
        const parts = m.parts !== null
            ? m.parts as object[]
            : [{ type: 'text' as const, text: m.content }]
        return {
            id: m.id,
            role: m.role.toLowerCase() as 'user' | 'assistant',
            parts,
        }
    })

    // 构建可用工具集
    const { tools, descriptors } = ctx.toolsOverride
        ? { tools: ctx.toolsOverride, descriptors: Object.keys(ctx.toolsOverride) }
        : await buildAvailableTools(db)

    const instructions = buildSystemPrompt(descriptors)

    // 每请求生成唯一 runId，作为本次 assistant Message 的 id
    const runId = crypto.randomUUID()
    type UIMessagePart = { type: string; [key: string]: unknown }
    let runningParts: UIMessagePart[] = []
    let runningUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

    const agent = buildAgent({
        model: llmModel as never,
        tools,
        instructions,
        onStepFinish: async (step) => {
            runningParts = appendStepToParts(runningParts, step as never)
            const u = step.usage ?? {}
            runningUsage = {
                inputTokens: runningUsage.inputTokens + ((u as { inputTokens?: number }).inputTokens ?? 0),
                outputTokens: runningUsage.outputTokens + ((u as { outputTokens?: number }).outputTokens ?? 0),
                totalTokens: runningUsage.totalTokens + ((u as { totalTokens?: number }).totalTokens ?? 0),
            }
            await upsertAssistantMessage(db, {
                id: runId,
                conversationId,
                parts: runningParts,
                usage: {
                    inputTokens: runningUsage.inputTokens,
                    outputTokens: runningUsage.outputTokens,
                    totalTokens: runningUsage.totalTokens,
                },
                modelIdAtTime: selection.modelId,
            })
        },
    })

    return createAgentUIStreamResponse({
        agent: agent as never,
        uiMessages: uiMessages as never,
        abortSignal: req.signal,
        messageMetadata: ({ part }: { part: { type: string; totalUsage?: { inputTokens: number; outputTokens: number; totalTokens: number } } }) => {
            if (part.type === 'finish' && part.totalUsage) {
                const inp = part.totalUsage.inputTokens ?? 0
                const out = part.totalUsage.outputTokens ?? 0
                return {
                    usage: { inputTokens: inp, outputTokens: out, totalTokens: inp + out },
                }
            }
        },
    })
}
