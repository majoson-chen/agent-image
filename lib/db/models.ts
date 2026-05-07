import type { ModelCreateBody, ModelPatchBody } from '@lib/validation/model-upsert-schema'
import type { Model, ModelType, Prisma, PrismaClient } from '~/generated/prisma/client'
import { getRegisterMetadata, parseModelConfig } from '@lib/providers/register-metadata'
import {

    modelCreateBodySchema,

    modelPatchBodySchema,
} from '@lib/validation/model-upsert-schema'

export async function listModels(prisma: PrismaClient, type?: ModelType) {
    return prisma.model.findMany({
        where: type ? { type } : undefined,
        orderBy: { createdAt: 'desc' },
    })
}

export async function getModel(prisma: PrismaClient, id: string) {
    return prisma.model.findUnique({ where: { id } })
}

export async function deleteModel(prisma: PrismaClient, id: string) {
    return prisma.model.delete({ where: { id } })
}

function assertRegisterMatchesType(body: Pick<ModelCreateBody, 'registerId' | 'type'>) {
    const metadata = getRegisterMetadata(body.registerId)
    if (!metadata || metadata.modelType !== body.type)
        throw new Error('registerId 与 type 不匹配')
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value)
}

function mergeConfig(existing: Model['config'], patch: ModelPatchBody['config']): unknown {
    if (patch === undefined)
        return existing
    if (isRecord(existing) && isRecord(patch))
        return { ...existing, ...patch }
    return patch
}

export async function createModel(prisma: PrismaClient, raw: unknown) {
    const body = modelCreateBodySchema.parse(raw)
    assertRegisterMatchesType(body)
    const config = parseModelConfig(body.registerId, body.config)

    return prisma.model.create({
        data: {
            type: body.type,
            registerId: body.registerId,
            name: body.name,
            config: config as Prisma.InputJsonValue,
        },
    })
}

export async function updateModel(
    prisma: PrismaClient,
    id: string,
    raw: unknown,
) {
    const patch = modelPatchBodySchema.parse(raw)
    const existing = await getModel(prisma, id)
    if (!existing)
        return null

    const registerId = patch.registerId ?? existing.registerId
    const body = { type: existing.type, registerId }
    assertRegisterMatchesType(body)

    const config = parseModelConfig(registerId, mergeConfig(existing.config, patch.config))

    return prisma.model.update({
        where: { id },
        data: {
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.registerId !== undefined && { registerId }),
            config: config as Prisma.InputJsonValue,
        },
    })
}
