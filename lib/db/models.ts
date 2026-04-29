import type { ModelType, PrismaClient } from '../../generated/prisma/client'
import type { LlmModelInput } from '../validation/llm-model-schema'
import { llmModelInputSchema } from '../validation/llm-model-schema'

export async function listModels(prisma: PrismaClient, type?: ModelType) {
    return prisma.model.findMany({
        where: type ? { type } : undefined,
        orderBy: { createdAt: 'desc' },
    })
}

export async function getModel(prisma: PrismaClient, id: string) {
    return prisma.model.findUnique({ where: { id } })
}

export async function createLlmModel(prisma: PrismaClient, input: LlmModelInput) {
    const parsed = llmModelInputSchema.parse(input)
    return prisma.model.create({
        data: {
            type: 'LLM',
            name: parsed.name,
            providerType: parsed.providerType,
            baseURL: parsed.baseURL ?? null,
            apiKey: parsed.apiKey,
            contextWindow: parsed.contextWindow,
            extraHeaders: parsed.extraHeaders ?? null,
            capabilities: parsed.capabilities ?? null,
        },
    })
}

export async function updateLlmModel(
    prisma: PrismaClient,
    id: string,
    patch: Partial<LlmModelInput>,
) {
    // 只更新显式传入的字段
    return prisma.model.update({
        where: { id },
        data: {
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.providerType !== undefined && { providerType: patch.providerType }),
            ...(patch.baseURL !== undefined && { baseURL: patch.baseURL }),
            ...(patch.apiKey !== undefined && { apiKey: patch.apiKey }),
            ...(patch.contextWindow !== undefined && { contextWindow: patch.contextWindow }),
            ...(patch.extraHeaders !== undefined && { extraHeaders: patch.extraHeaders }),
            ...(patch.capabilities !== undefined && { capabilities: patch.capabilities }),
        },
    })
}

export async function deleteModel(prisma: PrismaClient, id: string) {
    return prisma.model.delete({ where: { id } })
}
