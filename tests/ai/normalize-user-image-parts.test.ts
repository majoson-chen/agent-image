/** @vitest-environment node */

import type { PrismaClient } from '~/generated/prisma/client'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { hydrateApiImageFilePartsForModel } from '@lib/ai/normalize-user-image-parts'
import { createConversation } from '@lib/db/conversations'
import { createImage } from '@lib/db/images'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../helpers/db'

let prisma: PrismaClient
let cleanup: () => Promise<void>
let tmpDir: string

const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00])

beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDb())
})

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-normalize-test-'))
    process.env.DATA_IMAGES_ROOT = tmpDir
})
afterEach(async () => {
    delete process.env.DATA_IMAGES_ROOT
    await fs.rm(tmpDir, { recursive: true, force: true })
})

afterAll(() => cleanup())

describe('hydrateApiImageFilePartsForModel', () => {
    it('rewrites /api/images/{id} file parts to data URLs', async () => {
        const conv = await createConversation(prisma)
        const img = await createImage(prisma, {
            conversationId: conv.id,
            source: 'USER_UPLOAD',
            mimeType: 'image/png',
            sizeBytes: pngBuffer.length,
            buffer: pngBuffer,
        })

        const uiMessages = [
            {
                id: 'u1',
                role: 'user' as const,
                parts: [
                    { type: 'text', text: 'hi' },
                    { type: 'file', mediaType: 'image/png', url: `/api/images/${img.id}` },
                ],
            },
        ]

        const out = await hydrateApiImageFilePartsForModel(prisma, conv.id, uiMessages)
        expect(out).toHaveLength(1)
        const filePart = out[0]!.parts[1] as { type: string, url: string }
        expect(filePart.type).toBe('file')
        expect(filePart.url.startsWith('data:image/png;base64,')).toBe(true)
    })

    it('leaves assistant messages unchanged', async () => {
        const conv = await createConversation(prisma)
        const uiMessages = [
            {
                id: 'a1',
                role: 'assistant' as const,
                parts: [{ type: 'text', text: 'ok' }],
            },
        ]
        const out = await hydrateApiImageFilePartsForModel(prisma, conv.id, uiMessages)
        expect(out).toEqual(uiMessages)
    })
})
