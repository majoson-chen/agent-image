import { listRegisterMetadata, REGISTER_IDS } from '@lib/providers/registry'
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
