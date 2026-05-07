/**
 * U1 — Prisma schema 与迁移 characterization。
 *
 * 覆盖 registerId/config 后的 Model 形状、关系级联与关键唯一约束。
 */
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '~/generated/prisma/client'

function userPayload(text: string) {
    return {
        role: 'user' as const,
        parts: [{ type: 'text', text }],
        metadata: {},
    }
}

function assistantPayload(
    text: string,
    metadata?: {
        usage?: { inputTokens: number, outputTokens: number, totalTokens: number }
        modelIdAtTime?: string | null
    },
) {
    return {
        role: 'assistant' as const,
        parts: [{ type: 'text', text }],
        metadata: metadata ?? {},
    }
}

function llmModelData(name: string) {
    return {
        type: 'LLM' as const,
        name,
        registerId: 'openai/official',
        config: { modelId: name, apiKey: 'sk-test' },
    }
}

function imageModelData(name: string) {
    return {
        type: 'IMAGE' as const,
        name,
        registerId: 'volcengine/seedream',
        config: {
            requestModel: name,
            apiKey: 'ark-test',
            capabilities: { supportedSizes: ['1024x1024'], maxReferenceImages: 14, supportsSeed: false },
        },
    }
}

function searchModelData(name: string) {
    return {
        type: 'SEARCH' as const,
        name,
        registerId: 'brave/search',
        config: { apiKey: 'BSA-test-token' },
    }
}

let tmpDir: string
let dbPath: string
let prisma: PrismaClient

beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-test-'))
    dbPath = path.join(tmpDir, 'test.db')

    const { execSync } = await import('node:child_process')
    execSync(`DATABASE_URL="file:${dbPath}" bun --bun run prisma migrate deploy`, {
        stdio: 'pipe',
        cwd: process.cwd(),
    })

    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
    prisma = new PrismaClient({ adapter })
})

afterAll(async () => {
    await prisma.$disconnect()
    await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('model table', () => {
    it('creates a LLM model with registerId and config', async () => {
        const m = await prisma.model.create({ data: llmModelData('gpt-4o') })
        expect(m.id).toBeTruthy()
        expect(m.type).toBe('LLM')
        expect(m.registerId).toBe('openai/official')
        expect(m.config).toMatchObject({ modelId: 'gpt-4o', apiKey: 'sk-test' })
    })

    it('creates SEARCH and IMAGE model records', async () => {
        const search = await prisma.model.create({ data: searchModelData('Brave Search') })
        const image = await prisma.model.create({ data: imageModelData('doubao-seedream-4-5-251128') })

        expect(search.registerId).toBe('brave/search')
        expect(image.registerId).toBe('volcengine/seedream')
        expect(image.config).toMatchObject({ capabilities: { maxReferenceImages: 14 } })
    })
})

describe('conversation + Message cascade', () => {
    it('cascades delete conversation to messages and selections', async () => {
        const model = await prisma.model.create({ data: llmModelData('cascade-model') })
        const conv = await prisma.conversation.create({ data: {} })

        await prisma.message.create({
            data: {
                conversationId: conv.id,
                role: 'USER',
                payload: userPayload('hello'),
            },
        })
        await prisma.message.create({
            data: {
                conversationId: conv.id,
                role: 'ASSISTANT',
                payload: assistantPayload('hi', {
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 10 },
                    modelIdAtTime: model.id,
                }),
            },
        })
        await prisma.conversationModelSelection.create({
            data: { conversationId: conv.id, role: 'LLM', modelId: model.id },
        })

        await prisma.conversation.delete({ where: { id: conv.id } })

        await expect(prisma.message.findMany({ where: { conversationId: conv.id } })).resolves.toHaveLength(0)
        await expect(
            prisma.conversationModelSelection.findMany({ where: { conversationId: conv.id } }),
        ).resolves.toHaveLength(0)
    })

    it('keeps payload metadata modelIdAtTime after model is deleted', async () => {
        const model = await prisma.model.create({ data: llmModelData('temp-model') })
        const conv = await prisma.conversation.create({ data: {} })
        const msg = await prisma.message.create({
            data: {
                conversationId: conv.id,
                role: 'ASSISTANT',
                payload: assistantPayload('resp', { modelIdAtTime: model.id }),
            },
        })

        await prisma.model.delete({ where: { id: model.id } })

        const updated = await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })
        const payload = updated.payload as { metadata?: { modelIdAtTime?: string | null } }
        expect(payload.metadata?.modelIdAtTime).toBe(model.id)
    })
})

describe('SearchToolBinding', () => {
    it('creates SearchToolBinding and reads back with model', async () => {
        const m = await prisma.model.create({ data: searchModelData('Brave WEB') })
        const binding = await prisma.searchToolBinding.create({
            data: { tool: 'WEB_SEARCH', modelId: m.id },
            include: { model: true },
        })
        expect(binding.tool).toBe('WEB_SEARCH')
        expect(binding.model.id).toBe(m.id)
    })

    it('enforces UNIQUE on tool column', async () => {
        const m = await prisma.model.create({ data: searchModelData('Brave UNIQUE') })
        await prisma.searchToolBinding.create({ data: { tool: 'IMAGE_SEARCH', modelId: m.id } })
        await expect(
            prisma.searchToolBinding.create({ data: { tool: 'IMAGE_SEARCH', modelId: m.id } }),
        ).rejects.toThrow()
    })

    it('cascades delete SEARCH Model to binding removal', async () => {
        await prisma.searchToolBinding.deleteMany({ where: { tool: 'WEB_SEARCH' } })
        const m = await prisma.model.create({ data: searchModelData('Brave CASCADE') })
        const binding = await prisma.searchToolBinding.create({
            data: { tool: 'WEB_SEARCH', modelId: m.id },
        })
        await prisma.model.delete({ where: { id: m.id } })
        await expect(prisma.searchToolBinding.findUnique({ where: { id: binding.id } })).resolves.toBeNull()
    })
})

describe('image table', () => {
    it('creates GENERATED Image with modelIdAtTime and SetNull on model delete', async () => {
        const model = await prisma.model.create({ data: imageModelData('seedream-gen-test') })
        const conv = await prisma.conversation.create({ data: {} })
        const img = await prisma.image.create({
            data: {
                conversationId: conv.id,
                source: 'GENERATED',
                mimeType: 'image/jpeg',
                sizeBytes: 2048,
                modelIdAtTime: model.id,
            },
        })
        expect(img.modelIdAtTime).toBe(model.id)

        await prisma.model.delete({ where: { id: model.id } })
        const updated = await prisma.image.findUniqueOrThrow({ where: { id: img.id } })
        expect(updated.modelIdAtTime).toBeNull()
    })

    it('cascades delete Conversation to Image rows', async () => {
        const conv = await prisma.conversation.create({ data: {} })
        await prisma.image.create({
            data: { conversationId: conv.id, source: 'USER_UPLOAD', mimeType: 'image/png', sizeBytes: 100 },
        })
        await prisma.conversation.delete({ where: { id: conv.id } })
        await expect(prisma.image.findMany({ where: { conversationId: conv.id } })).resolves.toHaveLength(0)
    })
})

describe('conversationModelSelection', () => {
    it('writes params JSON and rejects duplicate conversation role', async () => {
        const model = await prisma.model.create({ data: imageModelData('params-test') })
        const conv = await prisma.conversation.create({ data: {} })
        const sel = await prisma.conversationModelSelection.create({
            data: { conversationId: conv.id, role: 'IMAGE_PRIMARY', modelId: model.id, params: { size: '2048x2048' } },
        })
        expect(sel.params).toEqual({ size: '2048x2048' })

        await expect(
            prisma.conversationModelSelection.create({
                data: { conversationId: conv.id, role: 'IMAGE_PRIMARY', modelId: model.id },
            }),
        ).rejects.toThrow()
    })
})
