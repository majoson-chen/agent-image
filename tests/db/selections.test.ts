import type { PrismaClient } from '~/generated/prisma/client'
import { createConversation } from '@lib/db/conversations'
import { createModel } from '@lib/db/models'
import { getAllSelections, getSelection, setSelection } from '@lib/db/selections'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
        const model = await createModel(prisma, {
            type: 'LLM',
            name: 'sel-model',
            registerId: 'openai/official',
            config: { modelId: 'sel-model', apiKey: 'sk-s' },
        })
        const conv = await createConversation(prisma)
        await setSelection(prisma, conv.id, 'LLM', model.id)
        const sel = await getSelection(prisma, conv.id, 'LLM')
        expect(sel?.modelId).toBe(model.id)
    })

    it('upserts when role already exists', async () => {
        const m1 = await createModel(prisma, {
            type: 'LLM',
            name: 'upsert-a',
            registerId: 'openai/official',
            config: { modelId: 'upsert-a', apiKey: 'sk-u1' },
        })
        const m2 = await createModel(prisma, {
            type: 'LLM',
            name: 'upsert-b',
            registerId: 'openai/official',
            config: { modelId: 'upsert-b', apiKey: 'sk-u2' },
        })
        const conv = await createConversation(prisma)
        await setSelection(prisma, conv.id, 'LLM', m1.id)
        await setSelection(prisma, conv.id, 'LLM', m2.id)
        const sel = await getSelection(prisma, conv.id, 'LLM')
        expect(sel?.modelId).toBe(m2.id)
    })
})

describe('setSelection with params (M3)', () => {
    it('sets IMAGE_PRIMARY with size param', async () => {
        const model = await prisma.model.create({
            data: {
                type: 'IMAGE',
                name: 'params-sel',
                registerId: 'volcengine/seedream',
                config: {
                    requestModel: 'params-sel',
                    apiKey: 'k',
                    capabilities: { supportedSizes: ['2048x2048'], maxReferenceImages: 0, supportsSeed: false },
                },
            },
        })
        const conv = await createConversation(prisma)
        await setSelection(prisma, conv.id, 'IMAGE_PRIMARY', model.id, { size: '2048x2048' })
        const sel = await getSelection(prisma, conv.id, 'IMAGE_PRIMARY')
        expect(sel?.params).toEqual({ size: '2048x2048' })
    })
})

describe('getAllSelections', () => {
    it('returns all three roles (some null)', async () => {
        const model = await createModel(prisma, {
            type: 'LLM',
            name: 'all-sel',
            registerId: 'openai/official',
            config: { modelId: 'all-sel', apiKey: 'sk-all' },
        })
        const conv = await createConversation(prisma)
        await setSelection(prisma, conv.id, 'LLM', model.id)

        const all = await getAllSelections(prisma, conv.id)
        expect(all.LLM?.modelId).toBe(model.id)
        expect(all.IMAGE_PRIMARY).toBeUndefined()
        expect(all.IMAGE_SECONDARY).toBeUndefined()
    })
})
