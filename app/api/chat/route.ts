import type { LanguageModel, ToolSet } from 'ai'
import type { PrismaClient } from '~/generated/prisma/client'
import { buildAgent } from '@lib/ai/build-agent'
import { dbRowsToUiMessagesForHydrate } from '@lib/ai/db-rows-to-ui-messages'
import {
    buildVisionUserModelMessage,
    buildVisionUserUiParts,
    extractImageFetchBatchesFromStep,
    mergeImageFetchBatchesForPersist,
} from '@lib/ai/image-fetch-vision-injection'
import { interleaveImageFetchVisionForModel } from '@lib/ai/interleave-image-fetch-vision-for-model'
import { hydrateApiImageFilePartsForModel } from '@lib/ai/normalize-user-image-parts'
import { repairDanglingImageGenerateToolParts } from '@lib/ai/repair-dangling-image-generate-parts'
import { appendStepToParts, patchToolResultsFromResponseMessages } from '@lib/ai/step-to-parts'
import { buildSystemPrompt } from '@lib/ai/system-prompt'
import { applyToolApprovalsToParts } from '@lib/ai/tool-approval-parts'
import { wrapLlmWithDevToolsIfDev } from '@lib/ai/wrap-llm-devtools'
import { parseMessagePayload } from '@lib/db/message-payload'
import {
    createUserMessageWithParts,
    InvalidUserMessageIdError,
    listMessages,
    MessageConversationMismatchError,
    upsertAssistantMessage,
    upsertUserMessageParts,
} from '@lib/db/messages'
import { getModel } from '@lib/db/models'
import { getSelection } from '@lib/db/selections'
import { computeLlmChatProviderOptions } from '@lib/llm-chat-provider-options'
import prismaDefault from '@lib/prisma'
import { buildLlmLanguageModel } from '@lib/providers/runtime/build-llm-from-model'
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

    const data = parsedBody.data
    const conversationId = data.conversationId

    const selection = await getSelection(db, conversationId, 'LLM')
    if (!selection)
        return NextResponse.json({ error: '请先选择 LLM 模型' }, { status: 400 })

    const modelRecord = await getModel(db, selection.modelId)
    if (!modelRecord)
        return NextResponse.json({ error: 'LLM 模型不存在' }, { status: 404 })

    const llmModel: LanguageModel = deps.model ?? wrapLlmWithDevToolsIfDev(buildLlmLanguageModel(modelRecord))
    const providerOptions = deps.model
        ? undefined
        : computeLlmChatProviderOptions(modelRecord, selection.params)

    let uiMessages: Array<{ id: string, role: 'user' | 'assistant', parts: object[] }>
    let runId: string
    let runningParts: UIMessagePart[]
    let runningUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

    if (data.kind === 'user-turn') {
        try {
            await upsertUserMessageParts(db, conversationId, { id: data.messageId, parts: data.parts })
        }
        catch (e) {
            if (e instanceof MessageConversationMismatchError || e instanceof InvalidUserMessageIdError)
                return NextResponse.json({ error: e.message }, { status: 400 })
            throw e
        }
        const rows = await listMessages(db, conversationId)
        uiMessages = interleaveImageFetchVisionForModel(dbRowsToUiMessagesForHydrate(rows))
        runId = crypto.randomUUID()
        runningParts = []
        runningUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    }
    else {
        const row = await db.message.findUnique({ where: { id: data.assistantMessageId } })
        if (!row || row.conversationId !== conversationId)
            return NextResponse.json({ error: '助手消息不存在' }, { status: 400 })
        if (row.role !== 'ASSISTANT')
            return NextResponse.json({ error: '无效助手消息' }, { status: 400 })
        const pl = parseMessagePayload(row.payload)
        const newParts = applyToolApprovalsToParts(pl.parts, data.approvals)
        await upsertAssistantMessage(db, {
            id: row.id,
            conversationId,
            parts: newParts as object[],
            usage: pl.metadata?.usage ?? { inputTokens: null, outputTokens: null, totalTokens: null },
            modelIdAtTime: pl.metadata?.modelIdAtTime ?? null,
        })
        const rows = await listMessages(db, conversationId)
        uiMessages = interleaveImageFetchVisionForModel(dbRowsToUiMessagesForHydrate(rows))
        runId = data.assistantMessageId
        runningParts = newParts as UIMessagePart[]
        runningUsage = {
            inputTokens: pl.metadata?.usage?.inputTokens ?? 0,
            outputTokens: pl.metadata?.usage?.outputTokens ?? 0,
            totalTokens: pl.metadata?.usage?.totalTokens ?? 0,
        }
    }

    const { tools, descriptors } = deps.toolsOverride
        ? { tools: deps.toolsOverride, descriptors: Object.keys(deps.toolsOverride) }
        : await buildAvailableTools(db, conversationId)

    const instructions = buildSystemPrompt(descriptors)

    const dbPersistedImageFetchToolCallIds = new Set<string>()
    /** 同请求内下一步 LLM 调用前注入像素，与 onStepFinish 写库互补（G5 / §6） */
    const modelInjectedImageFetchToolCallIds = new Set<string>()

    const agent = buildAgent({
        model: llmModel,
        tools,
        instructions,
        ...(providerOptions ? { providerOptions } : {}),
        prepareStep: async ({ steps, messages }) => {
            if (steps.length === 0)
                return {}
            const prev = steps[steps.length - 1]!
            const batches = extractImageFetchBatchesFromStep({ content: prev.content as never })
            const pending = batches.filter(b => !modelInjectedImageFetchToolCallIds.has(b.toolCallId))
            if (pending.length === 0)
                return {}
            const visionUser = await buildVisionUserModelMessage(db, conversationId, pending)
            for (const b of pending)
                modelInjectedImageFetchToolCallIds.add(b.toolCallId)
            return { messages: [...messages, visionUser] }
        },
        onStepFinish: async (step) => {
            const partsLenBefore = runningParts.length
            runningParts = appendStepToParts(runningParts, step as never)
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

            const appended = runningParts.slice(partsLenBefore)
            const fetchBatches = mergeImageFetchBatchesForPersist(step as never, appended)
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
                        + '重载会话后视觉上下文可能不一致。',
                        detail,
                    )
                }
            }
        },
    })

    const uiMessagesForModel = repairDanglingImageGenerateToolParts(
        await hydrateApiImageFilePartsForModel(db, conversationId, uiMessages),
    )

    return createAgentUIStreamResponse({
        agent,
        uiMessages: uiMessagesForModel,
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
