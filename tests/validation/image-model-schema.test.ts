import { describe, expect, it } from 'vitest'
import { imageModelInputSchema } from '../../lib/validation/image-model-schema'

describe('imageModelInputSchema', () => {
    const valid = {
        name: 'doubao-seedream-4-5-251128',
        providerType: 'VOLCENGINE_SEEDREAM' as const,
        apiKey: 'ark-key-123',
        capabilities: {
            supportedSizes: ['1024x1024', '2048x2048'],
            maxReferenceImages: 14,
            supportsSeed: false,
        },
    }

    it('accepts valid Seedream model input', () => {
        expect(imageModelInputSchema.safeParse(valid).success).toBe(true)
    })

    it('accepts optional baseURL', () => {
        const r = imageModelInputSchema.safeParse({
            ...valid,
            baseURL: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        })
        expect(r.success).toBe(true)
    })

    it('treats empty baseURL as undefined', () => {
        const r = imageModelInputSchema.safeParse({ ...valid, baseURL: '   ' })
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.data.baseURL).toBeUndefined()
        }
    })

    it('rejects invalid baseURL', () => {
        const r = imageModelInputSchema.safeParse({ ...valid, baseURL: 'not-a-url' })
        expect(r.success).toBe(false)
    })

    it('rejects empty name', () => {
        const r = imageModelInputSchema.safeParse({ ...valid, name: '' })
        expect(r.success).toBe(false)
    })

    it('rejects empty apiKey', () => {
        const r = imageModelInputSchema.safeParse({ ...valid, apiKey: '' })
        expect(r.success).toBe(false)
    })

    it('rejects empty supportedSizes array', () => {
        const r = imageModelInputSchema.safeParse({
            ...valid,
            capabilities: { ...valid.capabilities, supportedSizes: [] },
        })
        expect(r.success).toBe(false)
        expect(r.error?.issues[0].message).toMatch(/至少填写一项分辨率/)
    })

    it('rejects malformed size string', () => {
        const r = imageModelInputSchema.safeParse({
            ...valid,
            capabilities: { ...valid.capabilities, supportedSizes: ['2k'] },
        })
        expect(r.success).toBe(false)
    })

    it('accepts maxReferenceImages=0 (no reference images)', () => {
        const r = imageModelInputSchema.safeParse({
            ...valid,
            capabilities: { ...valid.capabilities, maxReferenceImages: 0 },
        })
        expect(r.success).toBe(true)
    })

    it('rejects maxReferenceImages > 14', () => {
        const r = imageModelInputSchema.safeParse({
            ...valid,
            capabilities: { ...valid.capabilities, maxReferenceImages: 15 },
        })
        expect(r.success).toBe(false)
    })

    it('rejects maxReferenceImages < 0', () => {
        const r = imageModelInputSchema.safeParse({
            ...valid,
            capabilities: { ...valid.capabilities, maxReferenceImages: -1 },
        })
        expect(r.success).toBe(false)
    })
})
