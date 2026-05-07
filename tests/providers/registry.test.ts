import { listRegisterMetadata, parseModelConfig, REGISTER_IDS } from '@lib/providers/registry'
import { describe, expect, it } from 'vitest'

describe('registry metadata', () => {
    it('lists only LLM registers for LLM', () => {
        const ids = listRegisterMetadata('LLM').map(m => m.registerId)
        expect(ids).toContain('openai/official')
        expect(ids.every(x => REGISTER_IDS.includes(x))).toBe(true)
        expect(ids).not.toContain('brave/search')
    })
    it('lists brave under SEARCH only', () => {
        expect(listRegisterMetadata('SEARCH').map(m => m.registerId)).toContain('brave/search')
    })
})

describe('parseModelConfig', () => {
    it('parses openai official config', () => {
        const c = parseModelConfig('openai/official', { modelId: 'gpt-4o', apiKey: 'sk' })
        expect(c).toMatchObject({ modelId: 'gpt-4o', apiKey: 'sk' })
    })

    it('rejects invalid openai compatible (missing baseURL)', () => {
        expect(() =>
            parseModelConfig('openai-compatible/generic', { modelId: 'x', apiKey: 'k' }),
        ).toThrow()
    })
})
