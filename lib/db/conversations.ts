import type { PrismaClient } from '../../generated/prisma/client'

export async function listConversations(prisma: PrismaClient) {
    return prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
    })
}

export async function getConversation(prisma: PrismaClient, id: string) {
    return prisma.conversation.findUnique({ where: { id } })
}

export async function createConversation(prisma: PrismaClient, title?: string) {
    return prisma.conversation.create({
        data: { title: title ?? null },
    })
}

export async function renameConversation(prisma: PrismaClient, id: string, title: string) {
    return prisma.conversation.update({ where: { id }, data: { title } })
}

export async function deleteConversation(prisma: PrismaClient, id: string) {
    return prisma.conversation.delete({ where: { id } })
}

export async function getMostRecent(prisma: PrismaClient) {
    return prisma.conversation.findFirst({ orderBy: { updatedAt: 'desc' } })
}
