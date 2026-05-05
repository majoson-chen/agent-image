/**
 * 模拟「image-fetch 落库后的 vision USER 行」经 listMessages → interleave → hydrate 后仍能展成 data URL（刷新后会话续写依赖此路径）
 */
/** @vitest-environment node */

import type { PrismaClient } from '~/generated/prisma/client'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { dbRowsToUiMessagesForHydrate } from '@lib/ai/db-rows-to-ui-messages'
import { interleaveImageFetchVisionForModel } from '@lib/ai/interleave-image-fetch-vision-for-model'
import { buildVisionInjectXml } from '@lib/ai/vision-inject-xml'
import { hydrateApiImageFilePartsForModel } from '@lib/ai/normalize-user-image-parts'
import { createConversation } from '@lib/db/conversations'
import { createImage } from '@lib/db/images'
import { createUserMessageWithParts, listMessages } from '@lib/db/messages'
import { toMessageRoleEnum } from '@lib/db/message-payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>
let tmpDir: string

const minimalGif = Buffer.from('GIF87a\x01\x00\x01\x00\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02', 'binary')

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-vision-rt-'))
    process.env.DATA_IMAGES_ROOT = tmpDir
})
afterEach(async () => {
    delete process.env.DATA_IMAGES_ROOT
    await fs.rm(tmpDir, { recursive: true, force: true })
})

afterAll(() => cleanup())

describe('vision persist DB round-trip + hydrate', () => {
    it('listMessages → interleave → hydrate：file parts 变为 data URL', async () => {
        const conv = await createConversation(prisma)
        const img = await createImage(prisma, {
            conversationId: conv.id,
            source: 'URL_FETCHED',
            mimeType: 'image/gif',
            sizeBytes: minimalGif.length,
            buffer: minimalGif,
        })

        const toolCallId = 'functions.image-fetch:1'
        const visionXml = buildVisionInjectXml([
            { toolCallId, images: [{ imageId: img.id, mimeType: 'image/gif' }], failureNotes: [] },
        ])

        await createUserMessageWithParts(prisma, conv.id, [{ type: 'text', text: '找猫图' }])

        await prisma.message.create({
            data: {
                id: 'asst-1',
                conversationId: conv.id,
                role: toMessageRoleEnum('assistant'),
                payload: {
                    role: 'assistant',
                    parts: [
                        { type: 'step-start' },
                        {
                            type: 'tool-image-fetch',
                            state: 'output-available',
                            toolCallId,
                            output: { items: [{ index: 0, ok: true, imageId: img.id, mimeType: 'image/gif' }] },
                        },
                        { type: 'step-start' },
                        { type: 'text', text: '已拉取。' },
                    ],
                    metadata: {
                        usage: { inputTokens: null, outputTokens: null, totalTokens: null },
                        modelIdAtTime: null,
                    },
                },
            },
        })

        await createUserMessageWithParts(prisma, conv.id, [
            { type: 'text', text: visionXml },
            { type: 'file', mediaType: 'image/gif', url: `/api/images/${img.id}` },
        ])

        await createUserMessageWithParts(prisma, conv.id, [{ type: 'text', text: '刷新后你还能看到图吗' }])

        const rows = await listMessages(prisma, conv.id)
        const ui = interleaveImageFetchVisionForModel(dbRowsToUiMessagesForHydrate(rows))
        const hydrated = await hydrateApiImageFilePartsForModel(prisma, conv.id, ui)

        const visionHydrated = hydrated.find(
            m => m.role === 'user' && m.parts[0] && typeof (m.parts[0] as { text?: string }).text === 'string'
                && (m.parts[0] as { text: string }).text.includes('<agent-image-fetch-vision'),
        )
        expect(visionHydrated).toBeDefined()
        const filePart = visionHydrated!.parts.find(p => (p as { type?: string }).type === 'file') as { type: string, url: string }
        expect(filePart.url.startsWith('data:image/gif;base64,')).toBe(true)
    })
})
