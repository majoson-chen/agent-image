import type { PrismaClient } from '../../generated/prisma/client'
/**
 * U3 — /api/models Route Handler 行为测试（dependency injection）
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DELETE, PATCH } from '../../app/api/models/[id]/route'
import { GET, POST } from '../../app/api/models/route'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
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
        const res = await GET(makeRequest('GET'), { prisma })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body)).toBe(true)
    })
})

describe('pOST /api/models', () => {
    it('creates a model and returns 201', async () => {
        const res = await POST(makeRequest('POST', {
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
        const res = await POST(makeRequest('POST', {
            name: '',
            providerType: 'OPENAI',
            apiKey: '',
            contextWindow: 0,
        }), { prisma })
        expect(res.status).toBe(422)
    })

    it('returns 422 when OPENAI_COMPATIBLE missing baseURL', async () => {
        const res = await POST(makeRequest('POST', {
            name: 'x',
            providerType: 'OPENAI_COMPATIBLE',
            apiKey: 'sk-x',
            contextWindow: 4096,
        }), { prisma })
        expect(res.status).toBe(422)
    })
})

describe('dELETE /api/models/[id]', () => {
    it('deletes and returns 204', async () => {
        const createRes = await POST(makeRequest('POST', {
            name: 'del-test',
            providerType: 'OPENAI',
            apiKey: 'sk-d',
            contextWindow: 1000,
        }), { prisma })
        const { id } = await createRes.json()

        const res = await DELETE(
            new Request(`http://localhost/api/models/${id}`, { method: 'DELETE' }),
            { params: Promise.resolve({ id }), prisma },
        )
        expect(res.status).toBe(204)
    })

    it('returns 404 when model not found', async () => {
        const res = await DELETE(
            new Request('http://localhost/api/models/bad', { method: 'DELETE' }),
            { params: Promise.resolve({ id: 'nonexistent-id' }), prisma },
        )
        expect(res.status).toBe(404)
    })
})

describe('pATCH /api/models/[id]', () => {
    it('updates model fields', async () => {
        const createRes = await POST(makeRequest('POST', {
            name: 'old-name',
            providerType: 'OPENAI',
            apiKey: 'sk-u',
            contextWindow: 4096,
        }), { prisma })
        const { id } = await createRes.json()

        const res = await PATCH(
            new Request(`http://localhost/api/models/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'new-name', contextWindow: 8192 }),
            }),
            { params: Promise.resolve({ id }), prisma },
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.name).toBe('new-name')
    })
})
