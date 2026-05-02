import type { LanguageModel, ToolSet } from 'ai'
import type { PrismaClient } from '~/generated/prisma/client'
import { buildAgent } from '@lib/ai/build-agent'
import {
    buildVisionUserModelMessage,
    buildVisionUserUiParts,
    extractImageFetchBatchesFromStep,
} from '@lib/ai/image-fetch-vision-injection'
import { appendStepToParts, patchToolResultsFromResponseMessages } from '@lib/ai/step-to-parts'
import { buildSystemPrompt } from '@lib/ai/system-prompt'
import {
    createUserMessageWithParts,
    listMessages,
    syncIncomingClientUserMessages,
    upsertAssistantMessage,
} from '@lib/db/messages'
import { getModel } from '@lib/db/models'
import { getSelection } from '@lib/db/selections'
import { computeLlmChatProviderOptions } from '@lib/llm-chat-provider-options'
import { buildLlmModel } from '@lib/llm-provider-factory'
import prismaDefault from '@lib/prisma'
import { buildAvailableTools } from '@lib/tools/tool-registry'
import { chatPostBodySchema } from '@lib/validation/chat-post-schema'
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

    const parsedBody = chatPostBodySchema.safeParse(raw)
    if (!parsedBody.success)
        return NextResponse.json({ error: '请求体无效', issues: parsedBody.error.flatten() }, { status: 400 })

    const { conversationId, messages: clientMessagesOpt } = parsedBody.data

    // 获取 LLM 选型
    const selection = await getSelection(db, conversationId, 'LLM')
    if (!selection)
        return NextResponse.json({ error: '请先选择 LLM 模型' }, { status: 400 })

    const modelRecord = await getModel(db, selection.modelId)
    if (!modelRecord)
        return NextResponse.json({ error: 'LLM 模型不存在' }, { status: 404 })

    const llmModel: LanguageModel = deps.model ?? buildLlmModel(modelRecord)
    const providerOptions = deps.model
        ? undefined
        : computeLlmChatProviderOptions(modelRecord, selection.params)

    // 消息历史：客户端 POST `messages`（与 useChat 一致）优先；否则仅从 DB 组装（兼容集成测试旧契约）
    let uiMessages: Array<{ id: string, role: 'user' | 'assistant', parts: object[] }>
    if (clientMessagesOpt && clientMessagesOpt.length > 0) {
        const synced = await syncIncomingClientUserMessages(db, conversationId, clientMessagesOpt)
        if (!synced.ok)
            return NextResponse.json({ error: synced.error }, { status: 400 })

        uiMessages = clientMessagesOpt.map(m => ({
            id: m.id,
            role: m.role.toLowerCase() as 'user' | 'assistant',
            parts: m.parts as object[],
        }))
    }
    else {
        const dbMessages = await listMessages(db, conversationId)
        uiMessages = dbMessages.map((m) => {
            const parts = m.parts !== null
                ? m.parts as object[]
                : [{ type: 'text' as const, text: m.content }]
            return {
                id: m.id,
                role: m.role.toLowerCase() as 'user' | 'assistant',
                parts,
            }
        })
    }

    // 构建可用工具集（传 conversationId 以按 IMAGE selection 暴露生图工具）
    const { tools, descriptors } = deps.toolsOverride
        ? { tools: deps.toolsOverride, descriptors: Object.keys(deps.toolsOverride) }
        : await buildAvailableTools(db, conversationId)

    const instructions = buildSystemPrompt(descriptors)

    // continuation（审批等）：仅当**最后一条**客户端消息为 assistant 时才复用其 id 更新同一 DB 行。
    // 若用 findLast(assistant)，在新一轮用户追问（…user, assistant, user）时会误绑到上一轮 assistant，
    // upsert 覆盖旧内容且 createdAt 不变，按 createdAt 排序会出现「assistant 排在最新 user 之前」的错位。
    const lastClientMsg = clientMessagesOpt?.at(-1)
    const continuingAssistant
        = lastClientMsg != null && lastClientMsg.role.toLowerCase() === 'assistant'

    let runId: string
    let runningParts: UIMessagePart[]
    let runningUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

    if (continuingAssistant) {
        runId = lastClientMsg.id
        // 从 DB 加载已有 parts 作为续写起点（可能含 input-available 工具 part）
        const dbMsg = await db.message.findUnique({ where: { id: runId } })
        runningParts = (dbMsg?.parts as UIMessagePart[] | null) ?? (lastClientMsg.parts as UIMessagePart[])
        runningUsage = {
            inputTokens: dbMsg?.usageInputTokens ?? 0,
            outputTokens: dbMsg?.usageOutputTokens ?? 0,
            totalTokens: dbMsg?.usageTotalTokens ?? 0,
        }
    }
    else {
        runId = crypto.randomUUID()
        runningParts = []
    }

    const modelInjectedImageFetchToolCallIds = new Set<string>()
    const dbPersistedImageFetchToolCallIds = new Set<string>()

    const agent = buildAgent({
        model: llmModel,
        tools,
        instructions,
        ...(providerOptions ? { providerOptions } : {}),
        prepareStep: async ({ steps, messages }) => {
            if (steps.length === 0)
                return {}
            const lastStep = steps[steps.length - 1]!
            const batches = extractImageFetchBatchesFromStep(lastStep)
            const pending = batches.filter(b => !modelInjectedImageFetchToolCallIds.has(b.toolCallId))
            if (pending.length === 0)
                return {}
            const visionUser = await buildVisionUserModelMessage(db, conversationId, pending)
            for (const b of pending)
                modelInjectedImageFetchToolCallIds.add(b.toolCallId)
            return { messages: [...messages, visionUser] }
        },
        onStepFinish: async (step) => {
            runningParts = appendStepToParts(runningParts, step as never)
            // 用 response.messages 里的 tool-result 回填跨步骤/跨请求的 input-available parts
            const respMsgs = (step as { response?: { messages?: unknown[] } }).response?.messages
            if (respMsgs) {
                runningParts = patchToolResultsFromResponseMessages(runningParts, respMsgs as never)
            }
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

            const fetchBatches = extractImageFetchBatchesFromStep(step)
            const toPersist = fetchBatches.filter(b => !dbPersistedImageFetchToolCallIds.has(b.toolCallId))
            if (toPersist.length > 0) {
                try {
                    const uiParts = await buildVisionUserUiParts(db, conversationId, toPersist)
                    await createUserMessageWithParts(db, conversationId, uiParts)
                    for (const b of toPersist)
                        dbPersistedImageFetchToolCallIds.add(b.toolCallId)
                }
                catch (e) {
                    const toolCallIds = toPersist.map(b => b.toolCallId).join(', ')
                    const detail = e instanceof Error ? e.message : String(e)
                    console.warn(
                        `[chat] image-fetch 合成 user 持久化失败：conversationId=${conversationId} toolCallIds=[${toolCallIds}]；`
                        + '模型本轮已通过 prepareStep 获得图像，但 DB 中缺少对应 user 消息，重载会话后视觉上下文可能不一致。',
                        detail,
                    )
                }
            }
        },
    })

    // 与 upsertAssistantMessage 使用同一 id：当末条为 user 时 SDK 默认不给助手消息设 id（见 UIMessageStreamOptions.generateMessageId），
    // useChat 会因缺少 id 合并流失败；延续轮末条为 assistant 时 SDK 会自带 id，此处返回同一 runId 仍安全。
    return createAgentUIStreamResponse({
        agent,
        uiMessages,
        abortSignal: req.signal,
        generateMessageId: () => runId,
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
