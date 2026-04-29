import type { PrismaClient } from '../../generated/prisma/client'
/**
 * U8 — 对话 CRUD API 行为测试（dependency injection）
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { handleDeleteConversation, handlePatchConversation } from '../../app/api/conversations/[id]/route'
import {
    handleConversationsGet,
    handleConversationsPost,
} from '../../app/api/conversations/route'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

describe('gET /api/conversations', () => {
    it('returns list', async () => {
        const res = await handleConversationsGet({ prisma })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body)).toBe(true)
    })
})

describe('pOST /api/conversations', () => {
    it('creates and returns 201', async () => {
        const res = await handleConversationsPost({ prisma })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.id).toBeTruthy()
    })
})

describe('pATCH /api/conversations/[id]', () => {
    it('renames and returns 200', async () => {
        const createRes = await handleConversationsPost({ prisma })
        const { id } = await createRes.json()

        const req = new Request('http://localhost', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: '  新标题  ' }),
        })
        const res = await handlePatchConversation(req, Promise.resolve({ id }), { prisma })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.title).toBe('新标题')
    })

    it('returns 422 for empty title', async () => {
        const createRes = await handleConversationsPost({ prisma })
        const { id } = await createRes.json()

        const req = new Request('http://localhost', {
            method: 'PATCH',
            body: JSON.stringify({ title: '   ' }),
        })
        const res = await handlePatchConversation(req, Promise.resolve({ id }), { prisma })
        expect(res.status).toBe(422)
    })

    it('returns 404 when not found', async () => {
        const req = new Request('http://localhost', {
            method: 'PATCH',
            body: JSON.stringify({ title: 'ok' }),
        })
        const res = await handlePatchConversation(req, Promise.resolve({ id: 'no-such' }), { prisma })
        expect(res.status).toBe(404)
    })
})

describe('dELETE /api/conversations/[id]', () => {
    it('returns 204', async () => {
        const createRes = await handleConversationsPost({ prisma })
        const { id } = await createRes.json()

        const res = await handleDeleteConversation(
            Promise.resolve({ id }),
            { prisma },
        )
        expect(res.status).toBe(204)
    })

    it('returns 404 when not found', async () => {
        const res = await handleDeleteConversation(
            Promise.resolve({ id: 'nonexistent-id' }),
            { prisma },
        )
        expect(res.status).toBe(404)
    })
})
