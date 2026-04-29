import type { PrismaClient } from '../../generated/prisma/client'
/**
 * U8 — 对话 CRUD API 行为测试（dependency injection）
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DELETE } from '../../app/api/conversations/[id]/route'
import { GET, POST } from '../../app/api/conversations/route'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

describe('gET /api/conversations', () => {
    it('returns list', async () => {
        const res = await GET(new Request('http://localhost/api/conversations'), { prisma })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body)).toBe(true)
    })
})

describe('pOST /api/conversations', () => {
    it('creates and returns 201', async () => {
        const res = await POST(new Request('http://localhost/api/conversations', { method: 'POST' }), { prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.id).toBeTruthy()
    })
})

describe('dELETE /api/conversations/[id]', () => {
    it('returns 204', async () => {
        const createRes = await POST(
            new Request('http://localhost/api/conversations', { method: 'POST' }),
            { prisma },
        )
        const { id } = await createRes.json()

        const res = await DELETE(
            new Request(`http://localhost/api/conversations/${id}`, { method: 'DELETE' }),
            { params: Promise.resolve({ id }), prisma },
        )
        expect(res.status).toBe(204)
    })

    it('returns 404 when not found', async () => {
        const res = await DELETE(
            new Request('http://localhost/api/conversations/bad', { method: 'DELETE' }),
            { params: Promise.resolve({ id: 'nonexistent-id' }), prisma },
        )
        expect(res.status).toBe(404)
    })
})
