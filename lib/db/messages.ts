import type { MessagePayload } from '@lib/db/message-payload'
import type { Prisma, PrismaClient } from '~/generated/prisma/client'
import { parseMessagePayload, toMessageRoleEnum } from '@lib/db/message-payload'

function messagePayloadJson(payload: MessagePayload): Prisma.InputJsonValue {
    return payload as unknown as Prisma.InputJsonValue
}

/** 同一 message id 已绑定其他会话（不得静默改写 conversationId） */
export class MessageConversationMismatchError extends Error {
    constructor() {
        super('消息 id 不属于本会话')
        this.name = 'MessageConversationMismatchError'
    }
}

/** message id 已存在但行角色不是 ASSISTANT */
export class InvalidAssistantMessageIdError extends Error {
    constructor() {
        super('无效的助手消息 id')
        this.name = 'InvalidAssistantMessageIdError'
    }
}

/** message id 已存在但行角色不是 USER */
export class InvalidUserMessageIdError extends Error {
    constructor() {
        super('无效的用户消息 id')
        this.name = 'InvalidUserMessageIdError'
    }
}

interface UsageInput {
    inputTokens: number | null
    outputTokens: number | null
    totalTokens: number | null
}

interface UpsertAssistantMessageInput {
    id: string
    conversationId: string
    parts: unknown[]
    usage: UsageInput
    modelIdAtTime: string | null
}

function buildPayloadForUser(parts: unknown[]): MessagePayload {
    return {
        role: 'user',
        parts,
        metadata: {},
    }
}

function buildPayloadForAssistant(
    parts: unknown[],
    usage: UsageInput,
    modelIdAtTime: string | null,
): MessagePayload {
    const hasUsage = usage.totalTokens != null
    return {
        role: 'assistant',
        parts,
        metadata: {
            ...(hasUsage
                ? {
                        usage: {
                            inputTokens: usage.inputTokens,
                            outputTokens: usage.outputTokens,
                            totalTokens: usage.totalTokens,
                        },
                    }
                : {}),
            modelIdAtTime,
        },
    }
}

export async function listMessages(prisma: PrismaClient, conversationId: string) {
    return prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
    })
}

export async function appendUserMessage(
    prisma: PrismaClient,
    conversationId: string,
    content: string,
) {
    const parts: object[] = [{ type: 'text', text: content }]
    const payload = buildPayloadForUser(parts)
    return prisma.message.create({
        data: {
            conversationId,
            role: toMessageRoleEnum('user'),
            payload: messagePayloadJson(payload),
        },
    })
}

/** 服务端插入一条带 parts 的用户消息（如 image-fetch 后的视觉上下文）。 */
export async function createUserMessageWithParts(
    prisma: PrismaClient,
    conversationId: string,
    parts: object[],
) {
    const payload = buildPayloadForUser(parts)
    return prisma.message.create({
        data: {
            id: crypto.randomUUID(),
            conversationId,
            role: toMessageRoleEnum('user'),
            payload: messagePayloadJson(payload),
        },
    })
}

export async function upsertUserMessageParts(
    prisma: PrismaClient,
    conversationId: string,
    input: { id: string, parts: unknown[] },
) {
    const existing = await prisma.message.findUnique({ where: { id: input.id } })
    if (existing) {
        if (existing.conversationId !== conversationId)
            throw new MessageConversationMismatchError()
        if (existing.role !== 'USER')
            throw new InvalidUserMessageIdError()
    }

    const parts = input.parts as object[]
    const payload = buildPayloadForUser(parts)
    return prisma.message.upsert({
        where: { id: input.id },
        create: {
            id: input.id,
            conversationId,
            role: toMessageRoleEnum('user'),
            payload: messagePayloadJson(payload),
        },
        update: {
            role: toMessageRoleEnum('user'),
            payload: messagePayloadJson(payload),
        },
    })
}

export async function appendAssistantMessage(
    prisma: PrismaClient,
    conversationId: string,
    content: string,
    usage: UsageInput,
    modelIdAtTime: string | null,
) {
    const parts: object[] = [{ type: 'text', text: content }]
    const payload = buildPayloadForAssistant(parts, usage, modelIdAtTime)
    return prisma.message.create({
        data: {
            conversationId,
            role: toMessageRoleEnum('assistant'),
            payload: messagePayloadJson(payload),
        },
    })
}

export async function upsertAssistantMessage(
    prisma: PrismaClient,
    input: UpsertAssistantMessageInput,
) {
    const existing = await prisma.message.findUnique({ where: { id: input.id } })
    if (existing) {
        if (existing.conversationId !== input.conversationId)
            throw new MessageConversationMismatchError()
        if (existing.role !== 'ASSISTANT')
            throw new InvalidAssistantMessageIdError()
    }

    const payload = buildPayloadForAssistant(
        input.parts as unknown[],
        input.usage,
        input.modelIdAtTime,
    )
    return prisma.message.upsert({
        where: { id: input.id },
        create: {
            id: input.id,
            conversationId: input.conversationId,
            role: toMessageRoleEnum('assistant'),
            payload: messagePayloadJson(payload),
        },
        update: {
            payload: messagePayloadJson(payload),
        },
    })
}

export async function aggregateUsage(
    prisma: PrismaClient,
    conversationId: string,
): Promise<{ inputTokens: number, outputTokens: number, totalTokens: number } | null> {
    const msgs = await prisma.message.findMany({
        where: { conversationId },
        select: { payload: true },
    })

    let inputTokens = 0
    let outputTokens = 0
    let totalTokens = 0
    let anyUsage = false

    for (const m of msgs) {
        const payload = parseMessagePayload(m.payload)
        const u = payload.metadata?.usage
        if (u?.totalTokens != null) {
            anyUsage = true
            inputTokens += u.inputTokens ?? 0
            outputTokens += u.outputTokens ?? 0
            totalTokens += u.totalTokens ?? 0
        }
    }

    if (!anyUsage)
        return null

    return { inputTokens, outputTokens, totalTokens }
}
