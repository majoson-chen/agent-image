import type { LanguageModel, ToolSet } from 'ai'
import type { PrismaClient } from '~/generated/prisma/client'
import { buildAgent } from '@lib/ai/build-agent'
import { hydrateImagesForLLM } from '@lib/ai/hydrate-images'
import { appendStepToParts } from '@lib/ai/step-to-parts'
import { buildSystemPrompt } from '@lib/ai/system-prompt'
import { listMessages, upsertAssistantMessage } from '@lib/db/messages'
import { getModel } from '@lib/db/models'
import { getSelection } from '@lib/db/selections'
import { buildLlmModel } from '@lib/llm-provider-factory'
import prismaDefault from '@lib/prisma'
import { buildAvailableTools } from '@lib/tools/tool-registry'
import { createAgentUIStreamResponse } from 'ai'
import { NextResponse } from 'next/server'

export interface ChatPostDeps {
    prisma?: PrismaClient
    model?: LanguageModel
    toolsOverride?: ToolSet
}

interface UIMessagePart { type: string, [key: string]: unknown }

/** Vitest / 集成测试注入 prisma、model、tools */
export async function handleChatPost(req: Request, deps: ChatPostDeps = {}) {
    const db = deps.prisma ?? prismaDefault
    let raw: unknown
    try {
        raw = await req.json()
    }
    catch {
        return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
    }

    const conversationId = typeof raw === 'object' && raw !== null && 'conversationId' in raw
        ? (raw as { conversationId?: unknown }).conversationId
        : undefined
    if (typeof conversationId !== 'string' || !conversationId.trim())
        return NextResponse.json({ error: 'conversationId 必填' }, { status: 400 })

    // 获取 LLM 选型
    const selection = await getSelection(db, conversationId, 'LLM')
    if (!selection)
        return NextResponse.json({ error: '请先选择 LLM 模型' }, { status: 400 })

    // 构建 LLM 模型实例
    let llmModel: LanguageModel
    if (deps.model) {
        llmModel = deps.model
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

    // 多模态 hydrate：把 user message 中的 image-ref parts 转为 image bytes
    const hydratedMessages = await hydrateImagesForLLM(uiMessages, db)

    // 构建可用工具集（传 conversationId 以按 IMAGE selection 暴露生图工具）
    const { tools, descriptors } = deps.toolsOverride
        ? { tools: deps.toolsOverride, descriptors: Object.keys(deps.toolsOverride) }
        : await buildAvailableTools(db, conversationId)

    const instructions = buildSystemPrompt(descriptors)

    // 每请求生成唯一 runId，作为本次 assistant Message 的 id
    const runId = crypto.randomUUID()
    let runningParts: UIMessagePart[] = []
    let runningUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

    const agent = buildAgent({
        model: llmModel,
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
        agent,
        uiMessages: hydratedMessages,
        abortSignal: req.signal,
        messageMetadata: ({ part }) => {
            if (part.type !== 'finish')
                return undefined
            const u = 'totalUsage' in part ? part.totalUsage : undefined
            if (!u)
                return undefined
            const inp = u.inputTokens ?? 0
            const out = u.outputTokens ?? 0
            const tot = u.totalTokens ?? inp + out
            return {
                usage: { inputTokens: inp, outputTokens: out, totalTokens: tot },
            }
        },
    })
}

export async function POST(req: Request) {
    return handleChatPost(req, {})
}
