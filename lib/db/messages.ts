import type { PrismaClient } from '../../generated/prisma/client'

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

function extractTextContent(parts: unknown[]): string {
    return parts
        .filter((p): p is { type: string, text: string } =>
            typeof p === 'object' && p !== null && (p as { type: string }).type === 'text',
        )
        .map(p => p.text)
        .join('')
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
    return prisma.message.create({
        data: { conversationId, role: 'USER', content },
    })
}

/** 客户端传来的 USER UIMessage id/parts 与本地会话对齐创建或更新（单机自用契约）。 */
export async function upsertUserMessageParts(
    prisma: PrismaClient,
    conversationId: string,
    input: { id: string, parts: unknown[] },
) {
    const content = extractTextContent(input.parts)
    const parts = input.parts as object[]
    return prisma.message.upsert({
        where: { id: input.id },
        create: {
            id: input.id,
            conversationId,
            role: 'USER',
            content,
            parts,
        },
        update: {
            content,
            parts,
        },
    })
}

/** POST body 中的 useChat messages：仅同步 role=user，且校验 id 不跨会话冲突。 */
export async function syncIncomingClientUserMessages(
    prisma: PrismaClient,
    conversationId: string,
    clientMessages: Array<{ id: string, role: string, parts: unknown[] }>,
): Promise<{ ok: true } | { ok: false, error: string }> {
    for (const m of clientMessages) {
        if (m.role.toLowerCase() !== 'user')
            continue

        const existing = await prisma.message.findUnique({ where: { id: m.id } })
        if (existing) {
            if (existing.conversationId !== conversationId)
                return { ok: false, error: '消息 id 不属于本会话' }
            if (existing.role !== 'USER')
                return { ok: false, error: '无效的用户消息 id' }
        }

        await upsertUserMessageParts(prisma, conversationId, { id: m.id, parts: m.parts })
    }

    return { ok: true }
}

export async function appendAssistantMessage(
    prisma: PrismaClient,
    conversationId: string,
    content: string,
    usage: UsageInput,
    modelIdAtTime: string | null,
) {
    return prisma.message.create({
        data: {
            conversationId,
            role: 'ASSISTANT',
            content,
            usageInputTokens: usage.inputTokens,
            usageOutputTokens: usage.outputTokens,
            usageTotalTokens: usage.totalTokens,
            modelIdAtTime,
        },
    })
}

export async function upsertAssistantMessage(
    prisma: PrismaClient,
    input: UpsertAssistantMessageInput,
) {
    const content = extractTextContent(input.parts)
    const data = {
        conversationId: input.conversationId,
        role: 'ASSISTANT' as const,
        content,
        parts: input.parts as object[],
        usageInputTokens: input.usage.inputTokens,
        usageOutputTokens: input.usage.outputTokens,
        usageTotalTokens: input.usage.totalTokens,
        modelIdAtTime: input.modelIdAtTime,
    }
    return prisma.message.upsert({
        where: { id: input.id },
        create: { id: input.id, ...data },
        update: {
            content,
            parts: input.parts as object[],
            usageInputTokens: input.usage.inputTokens,
            usageOutputTokens: input.usage.outputTokens,
            usageTotalTokens: input.usage.totalTokens,
        },
    })
}

export async function aggregateUsage(
    prisma: PrismaClient,
    conversationId: string,
): Promise<{ inputTokens: number, outputTokens: number, totalTokens: number } | null> {
    const msgs = await prisma.message.findMany({
        where: { conversationId, usageTotalTokens: { not: null } },
        select: { usageInputTokens: true, usageOutputTokens: true, usageTotalTokens: true },
    })

    if (msgs.length === 0)
        return null

    return msgs.reduce(
        (acc, m) => ({
            inputTokens: acc.inputTokens + (m.usageInputTokens ?? 0),
            outputTokens: acc.outputTokens + (m.usageOutputTokens ?? 0),
            totalTokens: acc.totalTokens + (m.usageTotalTokens ?? 0),
        }),
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    )
}
