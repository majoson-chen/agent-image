import type { PrismaClient } from '../../generated/prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createConversation } from '../../lib/db/conversations'
import { createLlmModel } from '../../lib/db/models'
import { getAllSelections, getSelection, setSelection } from '../../lib/db/selections'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

describe('getSelection', () => {
    it('returns null when no selection exists', async () => {
        const conv = await createConversation(prisma)
        expect(await getSelection(prisma, conv.id, 'LLM')).toBeNull()
    })
})

describe('setSelection', () => {
    it('creates a new selection', async () => {
        const model = await createLlmModel(prisma, {
            name: 'sel-model',
            providerType: 'OPENAI',
            apiKey: 'sk-s',
            contextWindow: 4000,
        })
        const conv = await createConversation(prisma)
        await setSelection(prisma, conv.id, 'LLM', model.id)
        const sel = await getSelection(prisma, conv.id, 'LLM')
        expect(sel?.modelId).toBe(model.id)
    })

    it('upserts when role already exists', async () => {
        const m1 = await createLlmModel(prisma, {
            name: 'upsert-a',
            providerType: 'OPENAI',
            apiKey: 'sk-u1',
            contextWindow: 4000,
        })
        const m2 = await createLlmModel(prisma, {
            name: 'upsert-b',
            providerType: 'OPENAI',
            apiKey: 'sk-u2',
            contextWindow: 4000,
        })
        const conv = await createConversation(prisma)
        await setSelection(prisma, conv.id, 'LLM', m1.id)
        await setSelection(prisma, conv.id, 'LLM', m2.id)
        const sel = await getSelection(prisma, conv.id, 'LLM')
        expect(sel?.modelId).toBe(m2.id)
    })
})

describe('getAllSelections', () => {
    it('returns all three roles (some null)', async () => {
        const model = await createLlmModel(prisma, {
            name: 'all-sel',
            providerType: 'OPENAI',
            apiKey: 'sk-all',
            contextWindow: 4000,
        })
        const conv = await createConversation(prisma)
        await setSelection(prisma, conv.id, 'LLM', model.id)

        const all = await getAllSelections(prisma, conv.id)
        expect(all.LLM?.modelId).toBe(model.id)
        expect(all.IMAGE_PRIMARY).toBeUndefined()
        expect(all.IMAGE_SECONDARY).toBeUndefined()
    })
})
