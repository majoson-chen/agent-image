import type { PrismaClient } from '~/generated/prisma/client'
import {
    createConversation,
    deleteConversation,
    getConversation,
    getMostRecent,
    listConversations,
} from '@lib/db/conversations'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

describe('getMostRecent', () => {
    it('returns null on empty db', async () => {
        expect(await getMostRecent(prisma)).toBeNull()
    })
})

describe('createConversation', () => {
    it('creates with optional title', async () => {
        const c = await createConversation(prisma, 'Test chat')
        expect(c.id).toBeTruthy()
        expect(c.title).toBe('Test chat')
    })

    it('creates without title', async () => {
        const c = await createConversation(prisma)
        expect(c.title).toBeNull()
    })
})

describe('listConversations', () => {
    it('returns conversations ordered by updatedAt desc', async () => {
        const list = await listConversations(prisma)
        expect(list.length).toBeGreaterThanOrEqual(2)
        for (let i = 1; i < list.length; i++) {
            expect(list[i - 1]!.updatedAt >= list[i]!.updatedAt).toBe(true)
        }
    })
})

describe('getConversation', () => {
    it('returns null for unknown id', async () => {
        expect(await getConversation(prisma, 'nope')).toBeNull()
    })
})

describe('deleteConversation', () => {
    it('removes conversation', async () => {
        const c = await createConversation(prisma)
        await deleteConversation(prisma, c.id)
        expect(await getConversation(prisma, c.id)).toBeNull()
    })
})

describe('getMostRecent after inserts', () => {
    it('returns the latest created conversation', async () => {
        const c = await createConversation(prisma, 'latest')
        const recent = await getMostRecent(prisma)
        expect(recent?.id).toBe(c.id)
    })
})
