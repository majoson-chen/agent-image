import { describe, expect, it } from 'vitest'
import { imageUploadSchema, MAX_UPLOAD_BYTES } from '../../lib/validation/image-upload-schema'

describe('imageUploadSchema', () => {
    it('accepts valid PNG upload', () => {
        const r = imageUploadSchema.safeParse({
            conversationId: 'conv1',
            mimeType: 'image/png',
            sizeBytes: 1024,
        })
        expect(r.success).toBe(true)
    })

    it('rejects empty conversationId', () => {
        const r = imageUploadSchema.safeParse({ conversationId: '', mimeType: 'image/png', sizeBytes: 100 })
        expect(r.success).toBe(false)
    })

    it('rejects 0-byte file', () => {
        const r = imageUploadSchema.safeParse({ conversationId: 'c1', mimeType: 'image/png', sizeBytes: 0 })
        expect(r.success).toBe(false)
        expect(r.error?.issues[0].message).toMatch(/文件为空/)
    })

    it(`rejects file over ${MAX_UPLOAD_BYTES} bytes`, () => {
        const r = imageUploadSchema.safeParse({ conversationId: 'c1', mimeType: 'image/png', sizeBytes: MAX_UPLOAD_BYTES + 1 })
        expect(r.success).toBe(false)
        expect(r.error?.issues[0].message).toMatch(/文件过大/)
    })

    it('rejects SVG mime type', () => {
        const r = imageUploadSchema.safeParse({ conversationId: 'c1', mimeType: 'image/svg+xml', sizeBytes: 100 })
        expect(r.success).toBe(false)
    })

    it('rejects EXE mime type', () => {
        const r = imageUploadSchema.safeParse({ conversationId: 'c1', mimeType: 'application/octet-stream', sizeBytes: 100 })
        expect(r.success).toBe(false)
    })
})
