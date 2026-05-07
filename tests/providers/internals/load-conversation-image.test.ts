import * as storage from '@lib/images/storage'
import { ConversationImageForbiddenError, ConversationImageNotFoundError, loadConversationImageBuffer } from '@lib/providers/_internals/load-conversation-image'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()

vi.spyOn(storage, 'readImageBuffer')

describe('loadConversationImageBuffer', () => {
    const prisma = { image: { findUnique } } as never

    beforeEach(() => {
        findUnique.mockReset()
        vi.mocked(storage.readImageBuffer).mockReset()
    })

    it('loads buffer when row belongs to conversation', async () => {
        findUnique.mockResolvedValueOnce({
            id: 'img-1',
            conversationId: 'c1',
            mimeType: 'image/png',
        })
        vi.mocked(storage.readImageBuffer).mockResolvedValueOnce(Buffer.from([1, 2, 3]))

        const got = await loadConversationImageBuffer(prisma, {
            conversationId: 'c1',
            imageId: 'img-1',
        })
        expect(got.mimeType).toBe('image/png')
        expect(got.buffer.length).toBe(3)
        expect(storage.readImageBuffer).toHaveBeenCalledWith('c1', 'img-1', 'image/png')
    })

    it('throws when image missing', async () => {
        findUnique.mockResolvedValueOnce(null)
        await expect(
            loadConversationImageBuffer(prisma, { conversationId: 'c1', imageId: 'x' }),
        ).rejects.toBeInstanceOf(ConversationImageNotFoundError)
    })

    it('throws when conversation mismatch', async () => {
        findUnique.mockResolvedValueOnce({
            id: 'img-1',
            conversationId: 'other',
            mimeType: 'image/png',
        })
        await expect(
            loadConversationImageBuffer(prisma, { conversationId: 'c1', imageId: 'img-1' }),
        ).rejects.toBeInstanceOf(ConversationImageForbiddenError)
    })
})
