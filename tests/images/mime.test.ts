import { describe, expect, it } from 'vitest'
import { detectMime, isAllowedMime, mimeToExt } from '../../lib/images/mime'

// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00])
// JPEG magic bytes: FF D8 FF
const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00])
// WEBP magic bytes: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
// GIF87a: 47 49 46 38 37 61
const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00])
// BMP: 42 4D
const bmpBuffer = Buffer.from([0x42, 0x4D, 0x00, 0x00])

describe('detectMime', () => {
    it('detects image/png', () => {
        expect(detectMime(pngBuffer)).toBe('image/png')
    })
    it('detects image/jpeg', () => {
        expect(detectMime(jpegBuffer)).toBe('image/jpeg')
    })
    it('detects image/webp', () => {
        expect(detectMime(webpBuffer)).toBe('image/webp')
    })
    it('detects image/gif', () => {
        expect(detectMime(gifBuffer)).toBe('image/gif')
    })
    it('detects image/bmp', () => {
        expect(detectMime(bmpBuffer)).toBe('image/bmp')
    })
    it('returns null for non-image buffer', () => {
        const textBuffer = Buffer.from('hello world')
        expect(detectMime(textBuffer)).toBeNull()
    })
})

describe('mimeToExt', () => {
    it('image/png -> .png', () => expect(mimeToExt('image/png')).toBe('.png'))
    it('image/jpeg -> .jpg', () => expect(mimeToExt('image/jpeg')).toBe('.jpg'))
    it('image/webp -> .webp', () => expect(mimeToExt('image/webp')).toBe('.webp'))
    it('image/gif -> .gif', () => expect(mimeToExt('image/gif')).toBe('.gif'))
    it('image/bmp -> .bmp', () => expect(mimeToExt('image/bmp')).toBe('.bmp'))
    it('throws for unsupported type', () => {
        expect(() => mimeToExt('image/svg+xml')).toThrow()
    })
})

describe('isAllowedMime', () => {
    it('allows png/jpeg/webp/bmp/gif', () => {
        expect(isAllowedMime('image/png')).toBe(true)
        expect(isAllowedMime('image/jpeg')).toBe(true)
        expect(isAllowedMime('image/webp')).toBe(true)
        expect(isAllowedMime('image/bmp')).toBe(true)
        expect(isAllowedMime('image/gif')).toBe(true)
    })
    it('rejects svg (XSS risk)', () => {
        expect(isAllowedMime('image/svg+xml')).toBe(false)
    })
    it('rejects unknown types', () => {
        expect(isAllowedMime('application/octet-stream')).toBe(false)
    })
})
