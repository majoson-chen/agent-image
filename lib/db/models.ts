import type { ModelType, PrismaClient } from '../../generated/prisma/client'
import type { ImageModelInput } from '../validation/image-model-schema'
import type { LlmModelInput } from '../validation/llm-model-schema'
import type { SearchModelInput } from '../validation/search-model-schema'
import { Prisma } from '../../generated/prisma/client'
import { imageModelInputSchema } from '../validation/image-model-schema'
import { llmModelInputSchema } from '../validation/llm-model-schema'
import { searchModelInputSchema } from '../validation/search-model-schema'

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
            ...(parsed.extraHeaders != null && {
                extraHeaders: parsed.extraHeaders as Prisma.InputJsonValue,
            }),
            ...(parsed.capabilities != null && {
                capabilities: parsed.capabilities as Prisma.InputJsonValue,
            }),
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
            ...(patch.extraHeaders !== undefined && {
                extraHeaders:
                    patch.extraHeaders === null
                        ? Prisma.JsonNull
                        : (patch.extraHeaders as Prisma.InputJsonValue),
            }),
            ...(patch.capabilities !== undefined && {
                capabilities:
                    patch.capabilities === null
                        ? Prisma.JsonNull
                        : (patch.capabilities as Prisma.InputJsonValue),
            }),
        },
    })
}

export async function deleteModel(prisma: PrismaClient, id: string) {
    return prisma.model.delete({ where: { id } })
}

export async function createSearchModel(prisma: PrismaClient, input: SearchModelInput) {
    const parsed = searchModelInputSchema.parse(input)
    return prisma.model.create({
        data: {
            type: 'SEARCH',
            name: parsed.name,
            providerType: parsed.providerType,
            apiKey: parsed.apiKey,
        },
    })
}

export async function createImageModel(prisma: PrismaClient, input: ImageModelInput) {
    const parsed = imageModelInputSchema.parse(input)
    return prisma.model.create({
        data: {
            type: 'IMAGE',
            name: parsed.name,
            providerType: parsed.providerType,
            baseURL: parsed.baseURL ?? null,
            apiKey: parsed.apiKey,
            capabilities: parsed.capabilities as unknown as object,
        },
    })
}

export async function updateSearchModel(
    prisma: PrismaClient,
    id: string,
    patch: Partial<Pick<SearchModelInput, 'name' | 'apiKey'>>,
) {
    return prisma.model.update({
        where: { id },
        data: {
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.apiKey !== undefined && { apiKey: patch.apiKey }),
        },
    })
}
