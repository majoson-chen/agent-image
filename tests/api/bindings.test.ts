/**
 * U3 — /api/bindings Route Handler 行为测试
 */
import type { PrismaClient } from '../../generated/prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
    handleBindingsDelete,
    handleBindingsGet,
    handleBindingsPut,
} from '../../app/api/bindings/route'
import { createLlmModel, createSearchModel } from '../../lib/db/models'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

function makeReq(method: string, body?: unknown, search?: string) {
    const url = `http://localhost/api/bindings${search ?? ''}`
    return new Request(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
    })
}

describe('gET /api/bindings', () => {
    it('returns empty bindings initially', async () => {
        const res = await handleBindingsGet({ prisma })
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toEqual({})
    })
})

describe('pUT /api/bindings', () => {
    it('sets a binding and reads it back via GET', async () => {
        const model = await createSearchModel(prisma, {
            name: 'brave-test',
            providerType: 'BRAVE_SEARCH',
            apiKey: 'bsa-test-key',
        })

        const res = await handleBindingsPut(
            makeReq('PUT', { tool: 'WEB_SEARCH', modelId: model.id }),
            { prisma },
        )
        expect(res.status).toBe(200)

        const getRes = await handleBindingsGet({ prisma })
        const data = await getRes.json()
        expect(data.WEB_SEARCH).toBe(model.id)
    })

    it('upserts when same tool bound twice', async () => {
        const m1 = await createSearchModel(prisma, {
            name: 'brave-a',
            providerType: 'BRAVE_SEARCH',
            apiKey: 'key-a',
        })
        const m2 = await createSearchModel(prisma, {
            name: 'brave-b',
            providerType: 'BRAVE_SEARCH',
            apiKey: 'key-b',
        })

        await handleBindingsPut(makeReq('PUT', { tool: 'IMAGE_SEARCH', modelId: m1.id }), { prisma })
        await handleBindingsPut(makeReq('PUT', { tool: 'IMAGE_SEARCH', modelId: m2.id }), { prisma })

        const getRes = await handleBindingsGet({ prisma })
        const data = await getRes.json()
        expect(data.IMAGE_SEARCH).toBe(m2.id)
    })

    it('returns 422 when tool is missing', async () => {
        const res = await handleBindingsPut(makeReq('PUT', { modelId: 'some-id' }), { prisma })
        expect(res.status).toBe(422)
    })

    it('returns 422 when modelId is missing', async () => {
        const res = await handleBindingsPut(makeReq('PUT', { tool: 'WEB_SEARCH' }), { prisma })
        expect(res.status).toBe(422)
    })

    it('returns 422 when trying to bind LLM model to search tool', async () => {
        const llm = await createLlmModel(prisma, {
            name: 'gpt-test',
            providerType: 'OPENAI',
            apiKey: 'sk-x',
            contextWindow: 4096,
        })
        const res = await handleBindingsPut(
            makeReq('PUT', { tool: 'WEB_SEARCH', modelId: llm.id }),
            { prisma },
        )
        expect(res.status).toBe(422)
    })
})

describe('dELETE /api/bindings', () => {
    it('clears a binding', async () => {
        const model = await createSearchModel(prisma, {
            name: 'brave-del',
            providerType: 'BRAVE_SEARCH',
            apiKey: 'key-del',
        })
        await handleBindingsPut(makeReq('PUT', { tool: 'WEB_SEARCH', modelId: model.id }), { prisma })

        const res = await handleBindingsDelete(
            makeReq('DELETE', undefined, '?tool=WEB_SEARCH'),
            { prisma },
        )
        expect(res.status).toBe(200)

        const getRes = await handleBindingsGet({ prisma })
        const data = await getRes.json()
        expect(data.WEB_SEARCH).toBeUndefined()
    })

    it('returns 422 when tool query param missing', async () => {
        const res = await handleBindingsDelete(makeReq('DELETE'), { prisma })
        expect(res.status).toBe(422)
    })
})
