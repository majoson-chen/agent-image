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
            type: 'LLM',
            name: 'gpt-4o',
            registerId: 'openai/official',
            config: { modelId: 'gpt-4o', apiKey: 'sk-x' },
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.name).toBe('gpt-4o')
    })

    it('returns 422 when config is invalid for registerId (parseModelConfig)', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            type: 'LLM',
            name: 'ok-name',
            registerId: 'openai/official',
            config: { modelId: 'gpt-4o', apiKey: '' },
        }), { prisma })
        expect(res.status).toBe(422)
        const body = await res.json() as { errors?: Array<{ path?: unknown[] }> }
        expect(body.errors?.some(e => Array.isArray(e.path) && e.path[0] === 'config')).toBe(true)
    })

    it('returns 422 on validation failure', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            type: 'LLM',
            name: '',
            registerId: 'openai/official',
            config: { modelId: 'gpt-4o', apiKey: '' },
        }), { prisma })
        expect(res.status).toBe(422)
    })

    it('returns 422 when OPENAI_COMPATIBLE missing baseURL', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            type: 'LLM',
            name: 'x',
            registerId: 'openai-compatible/generic',
            config: { modelId: 'x', apiKey: 'sk-x' },
        }), { prisma })
        expect(res.status).toBe(422)
    })

    it('creates ALIBABA LLM without baseURL and returns 201', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            type: 'LLM',
            name: 'qwen-plus',
            registerId: 'alibaba/dashscope-llm',
            config: { modelId: 'qwen-plus', apiKey: 'sk-dash' },
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.name).toBe('qwen-plus')
        expect(body.registerId).toBe('alibaba/dashscope-llm')
    })

    it('creates ALIBABA LLM with supportsThinking capability when provided', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            type: 'LLM',
            name: 'qwen-thinking',
            registerId: 'alibaba/dashscope-llm',
            config: { modelId: 'qwen-thinking', apiKey: 'sk-dash', capabilities: { supportsThinking: true } },
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.config).toMatchObject({ capabilities: { supportsThinking: true } })
    })

    it('creates IMAGE Seedream model with optional baseURL', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            type: 'IMAGE',
            name: 'doubao-seedream-4-5-251128',
            registerId: 'volcengine/seedream',
            config: {
                requestModel: 'doubao-seedream-4-5-251128',
                apiKey: 'ark-x',
                baseURL: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
                capabilities: {
                    supportedSizes: ['1024x1024'],
                    maxReferenceImages: 14,
                    supportsSeed: false,
                },
            },
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.config).toMatchObject({ baseURL: 'https://ark.cn-beijing.volces.com/api/v3/images/generations' })
    })

    it('creates IMAGE Wan model with DashScope provider', async () => {
        const res = await handleModelsPost(makeRequest('POST', {
            type: 'IMAGE',
            name: 'wan2.7-image-pro',
            registerId: 'dashscope/wan-image',
            config: {
                requestModel: 'wan2.7-image-pro',
                apiKey: 'sk-dash',
                capabilities: {
                    supportedSizes: ['2048x2048'],
                    maxReferenceImages: 4,
                    supportsSeed: true,
                },
            },
        }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.registerId).toBe('dashscope/wan-image')
    })
})

describe('dELETE /api/models/[id]', () => {
    it('deletes and returns 204', async () => {
        const createRes = await handleModelsPost(makeRequest('POST', {
            type: 'LLM',
            name: 'del-test',
            registerId: 'openai/official',
            config: { modelId: 'del-test', apiKey: 'sk-d' },
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
            type: 'LLM',
            name: 'old-name',
            registerId: 'openai/official',
            config: { modelId: 'old-name', apiKey: 'sk-u' },
        }), { prisma })
        const { id } = await createRes.json()

        const res = await handlePatchModel(
            new Request(`http://localhost/api/models/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'new-name', config: { modelId: 'new-model' } }),
            }),
            Promise.resolve({ id }),
            { prisma },
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.name).toBe('new-name')
    })
})
