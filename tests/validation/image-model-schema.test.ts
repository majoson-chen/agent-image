import { parseModelConfig } from '@lib/providers/registry'
import { describe, expect, it } from 'vitest'

describe('image register config schemas', () => {
    const valid = {
        requestModel: 'doubao-seedream-4-5-251128',
        apiKey: 'ark-key-123',
        capabilities: {
            supportedSizes: ['1024x1024', '2048x2048'],
            maxReferenceImages: 14,
            supportsSeed: false,
        },
    }

    it('accepts valid Seedream model input', () => {
        expect(parseModelConfig('volcengine/seedream', valid)).toMatchObject({
            requestModel: 'doubao-seedream-4-5-251128',
        })
    })

    it('accepts optional baseURL', () => {
        const r = parseModelConfig('volcengine/seedream', {
            ...valid,
            baseURL: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        })
        expect(r).toMatchObject({ baseURL: 'https://ark.cn-beijing.volces.com/api/v3/images/generations' })
    })

    it('rejects invalid baseURL', () => {
        expect(() => parseModelConfig('volcengine/seedream', { ...valid, baseURL: 'not-a-url' })).toThrow()
    })

    it('accepts valid DashScope Wan image model input', () => {
        const r = parseModelConfig('dashscope/wan-image', {
            requestModel: 'wan2.7-image-pro',
            apiKey: 'sk-dash',
            capabilities: {
                supportedSizes: ['1024x1024'],
                maxReferenceImages: 9,
                supportsSeed: true,
            },
        })
        expect(r).toMatchObject({ requestModel: 'wan2.7-image-pro' })
    })

    it('rejects Wan maxReferenceImages > 9', () => {
        expect(() => parseModelConfig('dashscope/wan-image', {
            requestModel: 'wan2.7-image',
            apiKey: 'sk-dash',
            capabilities: {
                supportedSizes: ['1024x1024'],
                maxReferenceImages: 10,
                supportsSeed: false,
            },
        })).toThrow()
    })

    it('rejects empty requestModel', () => {
        expect(() => parseModelConfig('volcengine/seedream', { ...valid, requestModel: '' })).toThrow()
    })

    it('rejects empty apiKey', () => {
        expect(() => parseModelConfig('volcengine/seedream', { ...valid, apiKey: '' })).toThrow()
    })

    it('rejects empty supportedSizes array', () => {
        expect(() => parseModelConfig('volcengine/seedream', {
            ...valid,
            capabilities: { ...valid.capabilities, supportedSizes: [] },
        })).toThrow(/至少填写一项分辨率/)
    })

    it('rejects malformed size string', () => {
        expect(() => parseModelConfig('volcengine/seedream', {
            ...valid,
            capabilities: { ...valid.capabilities, supportedSizes: ['2k'] },
        })).toThrow()
    })

    it('accepts maxReferenceImages=0 (no reference images)', () => {
        const r = parseModelConfig('volcengine/seedream', {
            ...valid,
            capabilities: { ...valid.capabilities, maxReferenceImages: 0 },
        })
        expect(r).toMatchObject({ capabilities: { maxReferenceImages: 0 } })
    })

    it('rejects maxReferenceImages > 14', () => {
        expect(() => parseModelConfig('volcengine/seedream', {
            ...valid,
            capabilities: { ...valid.capabilities, maxReferenceImages: 15 },
        })).toThrow()
    })

    it('rejects maxReferenceImages < 0', () => {
        expect(() => parseModelConfig('volcengine/seedream', {
            ...valid,
            capabilities: { ...valid.capabilities, maxReferenceImages: -1 },
        })).toThrow()
    })
})
