import type { PrismaClient } from '../../generated/prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
    createLlmModel,
    deleteModel,
    getModel,
    listModels,
    updateLlmModel,
} from '../../lib/db/models'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

describe('listModels', () => {
    it('returns empty array when no models', async () => {
        const result = await listModels(prisma)
        expect(result).toEqual([])
    })

    it('filters by type', async () => {
        await createLlmModel(prisma, {
            name: 'gpt-4o',
            providerType: 'OPENAI',
            apiKey: 'sk-1',
            contextWindow: 128000,
        })
        const llms = await listModels(prisma, 'LLM')
        expect(llms).toHaveLength(1)
        const images = await listModels(prisma, 'IMAGE')
        expect(images).toHaveLength(0)
    })
})

describe('createLlmModel', () => {
    it('creates model with required fields', async () => {
        const m = await createLlmModel(prisma, {
            name: 'moonshot-v1-8k',
            providerType: 'OPENAI_COMPATIBLE',
            baseURL: 'https://api.moonshot.cn/v1',
            apiKey: 'sk-moon',
            contextWindow: 8000,
        })
        expect(m.id).toBeTruthy()
        expect(m.type).toBe('LLM')
        expect(m.baseURL).toBe('https://api.moonshot.cn/v1')
    })

    it('throws when apiKey is empty', async () => {
        let threw = false
        try {
            await createLlmModel(prisma, {
                name: 'x',
                providerType: 'OPENAI',
                apiKey: '',
                contextWindow: 1000,
            })
        }
        catch { threw = true }
        expect(threw).toBe(true)
    })

    it('throws when contextWindow is 0', async () => {
        let threw = false
        try {
            await createLlmModel(prisma, {
                name: 'x',
                providerType: 'OPENAI',
                apiKey: 'sk-x',
                contextWindow: 0,
            })
        }
        catch { threw = true }
        expect(threw).toBe(true)
    })

    it('throws OPENAI_COMPATIBLE without baseURL', async () => {
        let threw = false
        try {
            await createLlmModel(prisma, {
                name: 'x',
                providerType: 'OPENAI_COMPATIBLE',
                apiKey: 'sk-x',
                contextWindow: 1000,
            })
        }
        catch { threw = true }
        expect(threw).toBe(true)
    })

    it('creates ALIBABA model without baseURL', async () => {
        const m = await createLlmModel(prisma, {
            name: 'qwen-plus',
            providerType: 'ALIBABA',
            apiKey: 'sk-dash',
            contextWindow: 128000,
        })
        expect(m.providerType).toBe('ALIBABA')
        expect(m.baseURL).toBeNull()
    })
})

describe('getModel', () => {
    it('returns model by id', async () => {
        const m = await createLlmModel(prisma, {
            name: 'get-test',
            providerType: 'OPENAI',
            apiKey: 'sk-g',
            contextWindow: 4096,
        })
        const found = await getModel(prisma, m.id)
        expect(found?.name).toBe('get-test')
    })

    it('returns null for unknown id', async () => {
        const result = await getModel(prisma, 'nonexistent')
        expect(result).toBeNull()
    })
})

describe('updateLlmModel', () => {
    it('updates name and contextWindow', async () => {
        const m = await createLlmModel(prisma, {
            name: 'old-name',
            providerType: 'OPENAI',
            apiKey: 'sk-u',
            contextWindow: 4096,
        })
        const updated = await updateLlmModel(prisma, m.id, { name: 'new-name', contextWindow: 8192 })
        expect(updated.name).toBe('new-name')
        expect(updated.contextWindow).toBe(8192)
    })
})

describe('deleteModel', () => {
    it('removes model from db', async () => {
        const m = await createLlmModel(prisma, {
            name: 'del-me',
            providerType: 'OPENAI',
            apiKey: 'sk-d',
            contextWindow: 1000,
        })
        await deleteModel(prisma, m.id)
        const found = await getModel(prisma, m.id)
        expect(found).toBeNull()
    })
})
