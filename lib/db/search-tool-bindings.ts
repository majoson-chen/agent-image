import type { PrismaClient, SearchTool } from '~/generated/prisma/client'

export async function getBinding(prisma: PrismaClient, tool: SearchTool) {
    return prisma.searchToolBinding.findUnique({ where: { tool } })
}

export async function setBinding(prisma: PrismaClient, tool: SearchTool, modelId: string) {
    await prisma.searchToolBinding.upsert({
        where: { tool },
        create: { tool, modelId },
        update: { modelId },
    })
}

export async function clearBinding(prisma: PrismaClient, tool: SearchTool) {
    await prisma.searchToolBinding.deleteMany({ where: { tool } })
}

export async function getAllBindings(
    prisma: PrismaClient,
): Promise<{ WEB_SEARCH?: string, IMAGE_SEARCH?: string }> {
    const bindings = await prisma.searchToolBinding.findMany()
    const result: { WEB_SEARCH?: string, IMAGE_SEARCH?: string } = {}
    for (const b of bindings) {
        if (b.tool === 'WEB_SEARCH')
            result.WEB_SEARCH = b.modelId
        else if (b.tool === 'IMAGE_SEARCH')
            result.IMAGE_SEARCH = b.modelId
    }
    return result
}
