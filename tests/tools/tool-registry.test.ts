/**
 * U5 — tool-registry 单测（test-first）
 * 验证根据 SearchToolBinding 动态拼装 tools 对象
 */
import type { PrismaClient } from '../../generated/prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSearchModel } from '../../lib/db/models'
import { clearBinding, setBinding } from '../../lib/db/search-tool-bindings'
import { buildAvailableTools } from '../../lib/tools/tool-registry'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})
afterAll(() => cleanup())

describe('buildAvailableTools', () => {
    it('with no bindings → only web-fetch', async () => {
        await clearBinding(prisma, 'WEB_SEARCH')
        await clearBinding(prisma, 'IMAGE_SEARCH')
        const { tools } = await buildAvailableTools(prisma)
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
        const { tools } = await buildAvailableTools(prisma)
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
        const { tools } = await buildAvailableTools(prisma)
        const keys = Object.keys(tools)
        expect(keys).toContain('web-search')
        expect(keys).toContain('image-search')
        expect(keys).toContain('web-fetch')
    })

    it('returns descriptors listing tool names', async () => {
        await clearBinding(prisma, 'WEB_SEARCH')
        await clearBinding(prisma, 'IMAGE_SEARCH')
        const { descriptors } = await buildAvailableTools(prisma)
        expect(descriptors).toContain('web-fetch')
    })
})
