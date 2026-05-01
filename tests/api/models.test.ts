import type { PrismaClient } from '~/generated/prisma/client'
/**
 * U3 — /api/models Route Handler 行为测试（dependency injection）
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { handleDeleteModel, handlePatchModel } from '@/api/models/[id]/route'
import { handleModelsGet, handleModelsPost } from '@/api/models/route'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ;({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

function makeRequest(method: string, body?: unknown): Request {
    return new Request('http://localhost/api/models', {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
    })
}

describe('gET /api/models', () => {
    it('returns list of models', async () => {
        const res = await handleModelsGet({ prisma })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body)).toBe(true)
    })
})

describe('pOST /api/models', () => {
    it('creates a model and returns 201', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            name: 'gpt-4o',
            providerType: 'OPENAI',
            apiKey: 'sk-x',
            contextWindow: 128000,
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.name).toBe('gpt-4o')
    })

    it('returns 422 on validation failure', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            name: '',
            providerType: 'OPENAI',
            apiKey: '',
            contextWindow: 0,
        }), { prisma })
        expect(res.status).toBe(422)
    })

    it('returns 422 when OPENAI_COMPATIBLE missing baseURL', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            name: 'x',
            providerType: 'OPENAI_COMPATIBLE',
            apiKey: 'sk-x',
            contextWindow: 4096,
        }), { prisma })
        expect(res.status).toBe(422)
    })

    it('creates ALIBABA LLM without baseURL and returns 201', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            name: 'qwen-plus',
            providerType: 'ALIBABA',
            apiKey: 'sk-dash',
            contextWindow: 128000,
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.name).toBe('qwen-plus')
        expect(body.providerType).toBe('ALIBABA')
        expect(body.baseURL).toBeNull()
    })

    it('creates ALIBABA LLM with supportsThinking capability when provided', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            name: 'qwen-thinking',
            providerType: 'ALIBABA',
            apiKey: 'sk-dash',
            contextWindow: 128000,
            capabilities: { supportsThinking: true },
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.capabilities).toEqual({ supportsThinking: true })
    })

    it('creates IMAGE Seedream model with optional baseURL', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            type: 'IMAGE',
            name: 'doubao-seedream-4-5-251128',
            providerType: 'VOLCENGINE_SEEDREAM',
            apiKey: 'ark-x',
            baseURL: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
            capabilities: {
                supportedSizes: ['1024x1024'],
                maxReferenceImages: 14,
                supportsSeed: false,
            },
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.baseURL).toBe('https://ark.cn-beijing.volces.com/api/v3/images/generations')
    })

    it('creates IMAGE Wan model with DashScope provider', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            type: 'IMAGE',
            name: 'wan2.7-image-pro',
            providerType: 'DASHSCOPE_WAN_IMAGE',
            apiKey: 'sk-dash',
            capabilities: {
                supportedSizes: ['2048x2048'],
                maxReferenceImages: 4,
                supportsSeed: true,
            },
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.providerType).toBe('DASHSCOPE_WAN_IMAGE')
    })
})

describe('dELETE /api/models/[id]', () => {
    it('deletes and returns 204', async () => {
        const createRes = await handleModelsPost(makeRequest('POST', {
            name: 'del-test',
            providerType: 'OPENAI',
            apiKey: 'sk-d',
            contextWindow: 1000,
        }), { prisma })
        const { id } = await createRes.json()

        const res = await handleDeleteModel(Promise.resolve({ id }), { prisma })
        expect(res.status).toBe(204)
    })

    it('returns 404 when model not found', async () => {
        const res = await handleDeleteModel(Promise.resolve({ id: 'nonexistent-id' }), { prisma })
        expect(res.status).toBe(404)
    })
})

describe('pATCH /api/models/[id]', () => {
    it('updates model fields', async () => {
        const createRes = await handleModelsPost(makeRequest('POST', {
            name: 'old-name',
            providerType: 'OPENAI',
            apiKey: 'sk-u',
            contextWindow: 4096,
        }), { prisma })
        const { id } = await createRes.json()

        const res = await handlePatchModel(
            new Request(`http://localhost/api/models/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'new-name', contextWindow: 8192 }),
            }),
            Promise.resolve({ id }),
            { prisma },
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.name).toBe('new-name')
    })
})
