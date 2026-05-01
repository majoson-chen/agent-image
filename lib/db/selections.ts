import type { PrismaClient, SelectionRole } from '~/generated/prisma/client'
import { Prisma } from '~/generated/prisma/client'

export async function getSelection(
    prisma: PrismaClient,
    conversationId: string,
    role: SelectionRole,
) {
    return prisma.conversationModelSelection.findUnique({
        where: { conversationId_role: { conversationId, role } },
        include: { model: true },
    })
}

export async function setSelection(
    prisma: PrismaClient,
    conversationId: string,
    role: SelectionRole,
    modelId: string,
    params?: Record<string, unknown> | null,
) {
    const payload
        = params === undefined
            ? {}
            : params === null
                ? { params: Prisma.DbNull }
                : { params: params as Prisma.InputJsonValue }

    return prisma.conversationModelSelection.upsert({
        where: { conversationId_role: { conversationId, role } },
        create: { conversationId, role, modelId, ...payload },
        update: { modelId, ...payload },
    })
}

export async function clearSelection(
    prisma: PrismaClient,
    conversationId: string,
    role: SelectionRole,
) {
    await prisma.conversationModelSelection.deleteMany({
        where: { conversationId, role },
    })
}

export async function getAllSelections(
    prisma: PrismaClient,
    conversationId: string,
) {
    const rows = await prisma.conversationModelSelection.findMany({
        where: { conversationId },
        include: { model: true },
    })
    const result: Partial<Record<SelectionRole, typeof rows[number]>> = {}
    for (const row of rows) {
        result[row.role] = row
    }
    return result
}
