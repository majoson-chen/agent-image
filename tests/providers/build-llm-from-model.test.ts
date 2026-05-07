import { buildLlmLanguageModel } from '@lib/providers/runtime/build-llm-from-model'
import { describe, expect, it } from 'vitest'

describe('buildLlmLanguageModel', () => {
    it('throws for unknown LLM registerId', () => {
        expect(() =>
            buildLlmLanguageModel({
                id: 'x',
                type: 'LLM',
                name: 'n',
                registerId: 'acme/nonexistent',
                config: {},
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
        ).toThrow(/unknown LLM registerId/)
    })
})
