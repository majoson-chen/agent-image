import { getCatalogRow, getLlmCatalogRowStrict, listRegisterMetadata } from '@lib/providers/registry'
import { describe, expect, it } from 'vitest'

describe('Register catalog', () => {
    it('every LLM registerId has buildLanguageModel via getLlmCatalogRowStrict', () => {
        const llmIds = listRegisterMetadata('LLM').map(r => r.registerId)
        for (const id of llmIds) {
            const row = getLlmCatalogRowStrict(id)
            expect(row.buildLanguageModel).toBeTypeOf('function')
        }
    })

    it('getLlmCatalogRowStrict throws for IMAGE registerId', () => {
        expect(() => getLlmCatalogRowStrict('volcengine/seedream')).toThrow(/unknown LLM registerId/)
    })

    it('getCatalogRow returns LLM row for openai/official', () => {
        expect(getCatalogRow('openai/official')?.modelType).toBe('LLM')
    })
})
