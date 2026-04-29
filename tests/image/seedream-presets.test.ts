import { describe, expect, it } from 'vitest'
import { getSeedreamPreset, SEEDREAM_DEFAULT_API_BASE_URL, SEEDREAM_PRESETS } from '../../lib/image/seedream-presets'

describe('seedream-presets', () => {
    it('exports non-empty preset list', () => {
        expect(SEEDREAM_PRESETS.length).toBeGreaterThan(0)
    })

    it('getSeedreamPreset returns model id', () => {
        const p = getSeedreamPreset('4-5-251128')
        expect(p.modelId).toBe('doubao-seedream-4-5-251128')
    })

    it('has stable default API URL constant', () => {
        expect(SEEDREAM_DEFAULT_API_BASE_URL).toMatch(/^https:\/\//)
    })
})
