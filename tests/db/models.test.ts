import type { PrismaClient } from '~/generated/prisma/client'
import {
    createModel,
    deleteModel,
    getModel,
    listModels,
    updateModel,
} from '@lib/db/models'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
        await createModel(prisma, {
            type: 'LLM',
            name: 'gpt-4o',
            registerId: 'openai/official',
            config: { modelId: 'gpt-4o', apiKey: 'sk-1' },
        })
        const llms = await listModels(prisma, 'LLM')
        expect(llms).toHaveLength(1)
        const images = await listModels(prisma, 'IMAGE')
        expect(images).toHaveLength(0)
    })
})

describe('createModel', () => {
    it('creates model with required fields', async () => {
        const m = await createModel(prisma, {
            type: 'LLM',
            name: 'moonshot-v1-8k',
            registerId: 'openai-compatible/generic',
            config: { modelId: 'moonshot-v1-8k', baseURL: 'https://api.moonshot.cn/v1', apiKey: 'sk-moon' },
        })
        expect(m.id).toBeTruthy()
        expect(m.type).toBe('LLM')
        expect(m.registerId).toBe('openai-compatible/generic')
        expect(m.config).toMatchObject({ baseURL: 'https://api.moonshot.cn/v1' })
    })

    it('throws when apiKey is empty', async () => {
        let threw = false
        try {
            await createModel(prisma, {
                type: 'LLM',
                name: 'x',
                registerId: 'openai/official',
                config: { modelId: 'x', apiKey: '' },
            })
        }
        catch { threw = true }
        expect(threw).toBe(true)
    })

    it('throws when registerId does not match type', async () => {
        let threw = false
        try {
            await createModel(prisma, {
                type: 'SEARCH',
                name: 'x',
                registerId: 'openai/official',
                config: { modelId: 'x', apiKey: 'sk-x' },
            })
        }
        catch { threw = true }
        expect(threw).toBe(true)
    })

    it('throws OPENAI_COMPATIBLE without baseURL', async () => {
        let threw = false
        try {
            await createModel(prisma, {
                type: 'LLM',
                name: 'x',
                registerId: 'openai-compatible/generic',
                config: { modelId: 'x', apiKey: 'sk-x' },
            })
        }
        catch { threw = true }
        expect(threw).toBe(true)
    })

    it('creates ALIBABA model without baseURL', async () => {
        const m = await createModel(prisma, {
            type: 'LLM',
            name: 'qwen-plus',
            registerId: 'alibaba/dashscope-llm',
            config: { modelId: 'qwen-plus', apiKey: 'sk-dash' },
        })
        expect(m.registerId).toBe('alibaba/dashscope-llm')
        expect(m.config).toMatchObject({ modelId: 'qwen-plus' })
    })
})

describe('getModel', () => {
    it('returns model by id', async () => {
        const m = await createModel(prisma, {
            type: 'LLM',
            name: 'get-test',
            registerId: 'openai/official',
            config: { modelId: 'get-test', apiKey: 'sk-g' },
        })
        const found = await getModel(prisma, m.id)
        expect(found?.name).toBe('get-test')
    })

    it('returns null for unknown id', async () => {
        const result = await getModel(prisma, 'nonexistent')
        expect(result).toBeNull()
    })
})

describe('updateModel', () => {
    it('updates name and merges config', async () => {
        const m = await createModel(prisma, {
            type: 'LLM',
            name: 'old-name',
            registerId: 'openai/official',
            config: { modelId: 'old-model', apiKey: 'sk-u' },
        })
        const updated = await updateModel(prisma, m.id, { name: 'new-name', config: { modelId: 'new-model' } })
        expect(updated?.name).toBe('new-name')
        expect(updated?.config).toMatchObject({ modelId: 'new-model', apiKey: 'sk-u' })
    })
})

describe('deleteModel', () => {
    it('removes model from db', async () => {
        const m = await createModel(prisma, {
            type: 'LLM',
            name: 'del-me',
            registerId: 'openai/official',
            config: { modelId: 'del-me', apiKey: 'sk-d' },
        })
        await deleteModel(prisma, m.id)
        const found = await getModel(prisma, m.id)
        expect(found).toBeNull()
    })
})
