/**
 * U5/U7 — tool-registry 单测（test-first）
 * 验证根据 SearchToolBinding + IMAGE selection 动态拼装 tools 对象
 */
import type { PrismaClient } from '~/generated/prisma/client'
import { createImageModel, createSearchModel } from '@lib/db/models'
import { clearBinding, setBinding } from '@lib/db/search-tool-bindings'
import { clearSelection, setSelection } from '@lib/db/selections'
import { buildAvailableTools } from '@lib/tools/tool-registry'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

async function createConversation(p: PrismaClient) {
    return p.conversation.create({ data: { title: 'test-conv' } })
}

async function createSeedreamModel(p: PrismaClient) {
    return createImageModel(p, {
        type: 'IMAGE',
        providerType: 'VOLCENGINE_SEEDREAM',
        name: 'doubao-seedream-4-5-251128',
        apiKey: 'sk-test',
        capabilities: {
            supportedSizes: ['1024x1024', '2048x2048'],
            maxReferenceImages: 4,
            supportsSeed: false,
        },
    })
}

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

describe('buildAvailableTools', () => {
    it('with no bindings → only web-fetch', async () => {
        await clearBinding(prisma, 'WEB_SEARCH')
        await clearBinding(prisma, 'IMAGE_SEARCH')
        const conv = await createConversation(prisma)
        const { tools } = await buildAvailableTools(prisma, conv.id)
        const keys = Object.keys(tools)
        expect(keys).toContain('web-fetch')
        expect(keys).not.toContain('web-search')
        expect(keys).not.toContain('image-search')
    })

    it('with WEB_SEARCH binding → web-search + web-fetch', async () => {
        await clearBinding(prisma, 'WEB_SEARCH')
        await clearBinding(prisma, 'IMAGE_SEARCH')
        const m = await createSearchModel(prisma, {
            type: 'SEARCH',
            providerType: 'BRAVE_SEARCH',
            name: 'Brave WEB',
            apiKey: 'BSA-test',
        })
        await setBinding(prisma, 'WEB_SEARCH', m.id)
        const conv = await createConversation(prisma)
        const { tools } = await buildAvailableTools(prisma, conv.id)
        const keys = Object.keys(tools)
        expect(keys).toContain('web-search')
        expect(keys).toContain('web-fetch')
        expect(keys).not.toContain('image-search')
    })

    it('with both bindings → all three tools', async () => {
        await clearBinding(prisma, 'WEB_SEARCH')
        await clearBinding(prisma, 'IMAGE_SEARCH')
        const m = await createSearchModel(prisma, {
            type: 'SEARCH',
            providerType: 'BRAVE_SEARCH',
            name: 'Brave BOTH',
            apiKey: 'BSA-test',
        })
        await setBinding(prisma, 'WEB_SEARCH', m.id)
        await setBinding(prisma, 'IMAGE_SEARCH', m.id)
        const conv = await createConversation(prisma)
        const { tools } = await buildAvailableTools(prisma, conv.id)
        const keys = Object.keys(tools)
        expect(keys).toContain('web-search')
        expect(keys).toContain('image-search')
        expect(keys).toContain('web-fetch')
    })

    it('returns descriptors listing tool names', async () => {
        await clearBinding(prisma, 'WEB_SEARCH')
        await clearBinding(prisma, 'IMAGE_SEARCH')
        const conv = await createConversation(prisma)
        const { descriptors } = await buildAvailableTools(prisma, conv.id)
        expect(descriptors).toContain('web-fetch')
    })
})

describe('buildAvailableTools - image tools', () => {
    it('iMAGE_PRIMARY selected → image-generate-primary exposed', async () => {
        const conv = await createConversation(prisma)
        const model = await createSeedreamModel(prisma)
        await setSelection(prisma, conv.id, 'IMAGE_PRIMARY', model.id, { size: '2048x2048' })

        const { tools } = await buildAvailableTools(prisma, conv.id)
        const keys = Object.keys(tools)
        expect(keys).toContain('image-generate-primary')
        expect(keys).not.toContain('image-generate-secondary')
    })

    it('both IMAGE selections → both generate tools exposed', async () => {
        const conv = await createConversation(prisma)
        const model = await createSeedreamModel(prisma)
        await setSelection(prisma, conv.id, 'IMAGE_PRIMARY', model.id, { size: '1024x1024' })
        await setSelection(prisma, conv.id, 'IMAGE_SECONDARY', model.id, { size: '2048x2048' })

        const { tools } = await buildAvailableTools(prisma, conv.id)
        const keys = Object.keys(tools)
        expect(keys).toContain('image-generate-primary')
        expect(keys).toContain('image-generate-secondary')
    })

    it('no IMAGE selection → no generate tools', async () => {
        const conv = await createConversation(prisma)
        await clearSelection(prisma, conv.id, 'IMAGE_PRIMARY')
        await clearSelection(prisma, conv.id, 'IMAGE_SECONDARY')

        const { tools } = await buildAvailableTools(prisma, conv.id)
        const keys = Object.keys(tools)
        expect(keys).not.toContain('image-generate-primary')
        expect(keys).not.toContain('image-generate-secondary')
    })

    it('descriptors include image-generate-primary when selected', async () => {
        const conv = await createConversation(prisma)
        const model = await createSeedreamModel(prisma)
        await setSelection(prisma, conv.id, 'IMAGE_PRIMARY', model.id, { size: '1024x1024' })

        const { descriptors } = await buildAvailableTools(prisma, conv.id)
        expect(descriptors).toContain('image-generate-primary')
    })
})
