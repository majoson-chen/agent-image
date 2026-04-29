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
        .filter((p): p is { type: string; text: string } =>
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
