/**
 * U1 — Prisma schema 与首次迁移（characterization-first）
 *
 * 断言 4 张表的关键约束与级联策略。
 * 使用临时文件 sqlite 隔离，每个测试文件独立 db。
 */
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { PrismaBunSqlite } from 'prisma-adapter-bun-sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../../generated/prisma/client'

let tmpDir: string
let dbPath: string
let prisma: PrismaClient

beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-test-'))
    dbPath = path.join(tmpDir, 'test.db')

    // migrate deploy 应用迁移到临时 db
    const { execSync } = await import('node:child_process')
    execSync(`DATABASE_URL="file:${dbPath}" bun --bun run prisma migrate deploy`, {
        stdio: 'pipe',
        cwd: process.cwd(),
    })

    const adapter = new PrismaBunSqlite({ url: `file:${dbPath}` })
    prisma = new PrismaClient({ adapter })
})

afterAll(async () => {
    await prisma.$disconnect()
    await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('model table', () => {
    it('creates a LLM type model', async () => {
        const m = await prisma.model.create({
            data: {
                type: 'LLM',
                name: 'gpt-4o',
                providerType: 'OPENAI',
                apiKey: 'sk-test',
                contextWindow: 128000,
            },
        })
        expect(m.id).toBeTruthy()
        expect(m.type).toBe('LLM')
        expect(m.contextWindow).toBe(128000)
    })
})

describe('conversation + Message cascade', () => {
    it('cascades delete conversation to messages and selections', async () => {
        const model = await prisma.model.create({
            data: {
                type: 'LLM',
                name: 'test-model',
                providerType: 'OPENAI_COMPATIBLE',
                baseURL: 'https://api.example.com/v1',
                apiKey: 'key',
                contextWindow: 4096,
            },
        })

        const conv = await prisma.conversation.create({ data: {} })

        await prisma.message.create({
            data: { conversationId: conv.id, role: 'USER', content: 'hello' },
        })
        await prisma.message.create({
            data: {
                conversationId: conv.id,
                role: 'ASSISTANT',
                content: 'hi',
                usageTotalTokens: 10,
                modelIdAtTime: model.id,
            },
        })
        await prisma.conversationModelSelection.create({
            data: { conversationId: conv.id, role: 'LLM', modelId: model.id },
        })

        await prisma.conversation.delete({ where: { id: conv.id } })

        const msgs = await prisma.message.findMany({ where: { conversationId: conv.id } })
        expect(msgs).toHaveLength(0)

        const sels = await prisma.conversationModelSelection.findMany({
            where: { conversationId: conv.id },
        })
        expect(sels).toHaveLength(0)
    })

    it('sets modelIdAtTime to null when model is deleted', async () => {
        const model = await prisma.model.create({
            data: {
                type: 'LLM',
                name: 'temp-model',
                providerType: 'OPENAI',
                apiKey: 'sk-x',
                contextWindow: 1000,
            },
        })
        const conv = await prisma.conversation.create({ data: {} })
        const msg = await prisma.message.create({
            data: {
                conversationId: conv.id,
                role: 'ASSISTANT',
                content: 'resp',
                modelIdAtTime: model.id,
            },
        })

        await prisma.model.delete({ where: { id: model.id } })

        const updated = await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })
        expect(updated.modelIdAtTime).toBeNull()
    })
})

describe('bRAVE_SEARCH model + SearchToolBinding', () => {
    it('creates a BRAVE_SEARCH model', async () => {
        const m = await prisma.model.create({
            data: {
                type: 'SEARCH',
                name: 'Brave Search',
                providerType: 'BRAVE_SEARCH',
                apiKey: 'BSA-test-token',
            },
        })
        expect(m.id).toBeTruthy()
        expect(m.type).toBe('SEARCH')
        expect(m.providerType).toBe('BRAVE_SEARCH')
        expect(m.contextWindow).toBeNull()
    })

    it('creates SearchToolBinding and reads back with model', async () => {
        const m = await prisma.model.create({
            data: {
                type: 'SEARCH',
                name: 'Brave WEB',
                providerType: 'BRAVE_SEARCH',
                apiKey: 'BSA-abc',
            },
        })
        const binding = await prisma.searchToolBinding.create({
            data: { tool: 'WEB_SEARCH', modelId: m.id },
            include: { model: true },
        })
        expect(binding.tool).toBe('WEB_SEARCH')
        expect(binding.model.id).toBe(m.id)
    })

    it('enforces UNIQUE on tool column', async () => {
        const m = await prisma.model.create({
            data: {
                type: 'SEARCH',
                name: 'Brave UNIQUE',
                providerType: 'BRAVE_SEARCH',
                apiKey: 'BSA-unique',
            },
        })
        await prisma.searchToolBinding.create({ data: { tool: 'IMAGE_SEARCH', modelId: m.id } })
        let threw = false
        try {
            await prisma.searchToolBinding.create({ data: { tool: 'IMAGE_SEARCH', modelId: m.id } })
        }
        catch {
            threw = true
        }
        expect(threw).toBe(true)
    })

    it('cascades delete SEARCH Model → binding removed', async () => {
        // 清理可能存在的同 tool 绑定，避免 UNIQUE 冲突
        await prisma.searchToolBinding.deleteMany({ where: { tool: 'WEB_SEARCH' } })
        const m = await prisma.model.create({
            data: {
                type: 'SEARCH',
                name: 'Brave CASCADE',
                providerType: 'BRAVE_SEARCH',
                apiKey: 'BSA-cascade',
            },
        })
        const binding = await prisma.searchToolBinding.create({
            data: { tool: 'WEB_SEARCH', modelId: m.id },
        })
        await prisma.model.delete({ where: { id: m.id } })
        const found = await prisma.searchToolBinding.findUnique({ where: { id: binding.id } })
        expect(found).toBeNull()
    })
})

describe('message.parts column', () => {
    it('writes and reads back parts JSON', async () => {
        const conv = await prisma.conversation.create({ data: {} })
        const parts = [
            { type: 'text', text: 'Hello' },
            { type: 'tool-web-search', state: 'output-available', toolCallId: 'tc1', input: { query: 'test' }, output: { items: [] } },
        ]
        const msg = await prisma.message.create({
            data: { conversationId: conv.id, role: 'ASSISTANT', content: 'Hello', parts: parts as unknown as object },
        })
        const found = await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })
        expect(found.parts).toEqual(parts)
    })

    it('m1 legacy message parts=null stays null', async () => {
        const conv = await prisma.conversation.create({ data: {} })
        const msg = await prisma.message.create({
            data: { conversationId: conv.id, role: 'ASSISTANT', content: 'legacy' },
        })
        const found = await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })
        expect(found.parts).toBeNull()
    })
})

describe('vOLCENGINE_SEEDREAM model (M3)', () => {
    it('creates a VOLCENGINE_SEEDREAM model with IMAGE type', async () => {
        const m = await prisma.model.create({
            data: {
                type: 'IMAGE',
                name: 'doubao-seedream-4-5-251128',
                providerType: 'VOLCENGINE_SEEDREAM',
                apiKey: 'ark-test-key',
                capabilities: { supportedSizes: ['1024x1024', '2048x2048'], maxReferenceImages: 14, supportsSeed: false },
            },
        })
        expect(m.type).toBe('IMAGE')
        expect(m.providerType).toBe('VOLCENGINE_SEEDREAM')
        expect(m.capabilities).toMatchObject({ maxReferenceImages: 14 })
    })
})

describe('image table (M3)', () => {
    it('creates USER_UPLOAD Image and reads back', async () => {
        const conv = await prisma.conversation.create({ data: {} })
        const img = await prisma.image.create({
            data: {
                conversationId: conv.id,
                source: 'USER_UPLOAD',
                mimeType: 'image/png',
                sizeBytes: 1024,
                width: 100,
                height: 100,
            },
        })
        expect(img.source).toBe('USER_UPLOAD')
        expect(img.modelIdAtTime).toBeNull()

        const found = await prisma.image.findUniqueOrThrow({
            where: { id: img.id },
            include: { conversation: true },
        })
        expect(found.conversation.id).toBe(conv.id)
    })

    it('creates GENERATED Image with modelIdAtTime', async () => {
        const model = await prisma.model.create({
            data: {
                type: 'IMAGE',
                name: 'seedream-gen-test',
                providerType: 'VOLCENGINE_SEEDREAM',
                apiKey: 'key',
            },
        })
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
        expect(img.source).toBe('GENERATED')
        expect(img.modelIdAtTime).toBe(model.id)
    })

    it('cascades delete Conversation → Image rows deleted', async () => {
        const conv = await prisma.conversation.create({ data: {} })
        await prisma.image.create({
            data: { conversationId: conv.id, source: 'USER_UPLOAD', mimeType: 'image/png', sizeBytes: 100 },
        })
        await prisma.conversation.delete({ where: { id: conv.id } })
        const images = await prisma.image.findMany({ where: { conversationId: conv.id } })
        expect(images).toHaveLength(0)
    })

    it('sets modelIdAtTime to null when Model is deleted (SetNull)', async () => {
        const model = await prisma.model.create({
            data: {
                type: 'IMAGE',
                name: 'setnull-test',
                providerType: 'VOLCENGINE_SEEDREAM',
                apiKey: 'key',
            },
        })
        const conv = await prisma.conversation.create({ data: {} })
        const img = await prisma.image.create({
            data: {
                conversationId: conv.id,
                source: 'GENERATED',
                mimeType: 'image/png',
                sizeBytes: 100,
                modelIdAtTime: model.id,
            },
        })
        await prisma.model.delete({ where: { id: model.id } })
        const updated = await prisma.image.findUniqueOrThrow({ where: { id: img.id } })
        expect(updated.modelIdAtTime).toBeNull()
    })
})

describe('conversationModelSelection.params (M3)', () => {
    it('writes and reads back params JSON for IMAGE_PRIMARY', async () => {
        const model = await prisma.model.create({
            data: {
                type: 'IMAGE',
                name: 'params-test',
                providerType: 'VOLCENGINE_SEEDREAM',
                apiKey: 'key',
            },
        })
        const conv = await prisma.conversation.create({ data: {} })
        const sel = await prisma.conversationModelSelection.create({
            data: { conversationId: conv.id, role: 'IMAGE_PRIMARY', modelId: model.id, params: { size: '2048x2048' } },
        })
        expect(sel.params).toEqual({ size: '2048x2048' })
    })

    it('m2 legacy selection params is null', async () => {
        const model = await prisma.model.create({
            data: {
                type: 'LLM',
                name: 'legacy-params',
                providerType: 'OPENAI',
                apiKey: 'sk-leg',
                contextWindow: 4000,
            },
        })
        const conv = await prisma.conversation.create({ data: {} })
        const sel = await prisma.conversationModelSelection.create({
            data: { conversationId: conv.id, role: 'LLM', modelId: model.id },
        })
        expect(sel.params).toBeNull()
    })
})

describe('conversationModelSelection unique constraint', () => {
    it('rejects duplicate (conversationId, role)', async () => {
        const model = await prisma.model.create({
            data: {
                type: 'LLM',
                name: 'dup-test',
                providerType: 'OPENAI',
                apiKey: 'sk-y',
                contextWindow: 2000,
            },
        })
        const conv = await prisma.conversation.create({ data: {} })

        await prisma.conversationModelSelection.create({
            data: { conversationId: conv.id, role: 'LLM', modelId: model.id },
        })

        let threw = false
        try {
            await prisma.conversationModelSelection.create({
                data: { conversationId: conv.id, role: 'LLM', modelId: model.id },
            })
        }
        catch {
            threw = true
        }
        expect(threw).toBe(true)
    })

    it('deletes selection when model is deleted', async () => {
        const model = await prisma.model.create({
            data: {
                type: 'LLM',
                name: 'sel-cascade',
                providerType: 'OPENAI',
                apiKey: 'sk-z',
                contextWindow: 3000,
            },
        })
        const conv = await prisma.conversation.create({ data: {} })
        await prisma.conversationModelSelection.create({
            data: { conversationId: conv.id, role: 'LLM', modelId: model.id },
        })

        await prisma.model.delete({ where: { id: model.id } })

        const sels = await prisma.conversationModelSelection.findMany({
            where: { conversationId: conv.id },
        })
        expect(sels).toHaveLength(0)
    })
})
