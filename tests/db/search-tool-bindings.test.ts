/**
 * U2 — SearchToolBinding CRUD 测试（test-first）
 */
import type { PrismaClient } from '~/generated/prisma/client'
import { createModel } from '@lib/db/models'
import {
    clearBinding,
    getAllBindings,
    getBinding,
    setBinding,
} from '@lib/db/search-tool-bindings'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

async function makeBraveModel(name = 'Brave') {
    return createModel(prisma, {
        type: 'SEARCH',
        name,
        registerId: 'brave/search',
        config: { apiKey: 'BSA-test' },
    })
}

describe('setBinding / getBinding', () => {
    it('sets and reads back a binding', async () => {
        const m = await makeBraveModel('b1')
        await setBinding(prisma, 'WEB_SEARCH', m.id)
        const binding = await getBinding(prisma, 'WEB_SEARCH')
        expect(binding?.modelId).toBe(m.id)
    })

    it('upsert: second setBinding replaces first', async () => {
        const m1 = await makeBraveModel('b2a')
        const m2 = await makeBraveModel('b2b')
        await setBinding(prisma, 'IMAGE_SEARCH', m1.id)
        await setBinding(prisma, 'IMAGE_SEARCH', m2.id)
        const binding = await getBinding(prisma, 'IMAGE_SEARCH')
        expect(binding?.modelId).toBe(m2.id)
    })

    it('returns null for unset binding', async () => {
        // 先清理确保无 WEB_SEARCH（可能被上面测试占用）
        await clearBinding(prisma, 'WEB_SEARCH')
        const binding = await getBinding(prisma, 'WEB_SEARCH')
        expect(binding).toBeNull()
    })
})

describe('clearBinding', () => {
    it('clears an existing binding', async () => {
        const m = await makeBraveModel('clear-test')
        await setBinding(prisma, 'WEB_SEARCH', m.id)
        await clearBinding(prisma, 'WEB_SEARCH')
        expect(await getBinding(prisma, 'WEB_SEARCH')).toBeNull()
    })

    it('clearBinding on non-existent is a no-op', async () => {
        await clearBinding(prisma, 'WEB_SEARCH')
        await expect(clearBinding(prisma, 'WEB_SEARCH')).resolves.toBeUndefined()
    })
})

describe('getAllBindings', () => {
    it('returns both bindings when both are set', async () => {
        const m1 = await makeBraveModel('ga-web')
        const m2 = await makeBraveModel('ga-img')
        await setBinding(prisma, 'WEB_SEARCH', m1.id)
        await setBinding(prisma, 'IMAGE_SEARCH', m2.id)
        const all = await getAllBindings(prisma)
        expect(all.WEB_SEARCH).toBe(m1.id)
        expect(all.IMAGE_SEARCH).toBe(m2.id)
    })

    it('returns only present keys', async () => {
        await clearBinding(prisma, 'IMAGE_SEARCH')
        const all = await getAllBindings(prisma)
        expect('IMAGE_SEARCH' in all).toBe(false)
    })
})
