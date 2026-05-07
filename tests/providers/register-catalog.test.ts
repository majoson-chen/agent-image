import { listRegisterMetadata } from '@lib/providers/register-metadata'
import { getCatalogRow, getImageCatalogRowStrict, getLlmCatalogRowStrict } from '@lib/providers/registry'
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

    it('every IMAGE registerId exposes image.tool and image.execution hooks', () => {
        const imageIds = listRegisterMetadata('IMAGE').map(r => r.registerId)
        for (const id of imageIds) {
            const row = getImageCatalogRowStrict(id)
            expect(row.createImageGenerateTool).toBeTypeOf('function')
            expect(row.executeImageGeneration).toBeTypeOf('function')
        }
    })
})
