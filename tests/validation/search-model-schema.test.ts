import { parseModelConfig } from '@lib/providers/register-metadata'
/**
 * U2 — Brave Search register config zod 校验测试
 */
import { describe, expect, it } from 'vitest'

describe('brave/search config schema', () => {
    it('accepts valid Brave Search input', () => {
        const result = parseModelConfig('brave/search', {
            apiKey: 'BSA-token',
        })
        expect(result).toEqual({ apiKey: 'BSA-token' })
    })

    it('rejects empty apiKey', () => {
        expect(() => parseModelConfig('brave/search', {
            apiKey: '',
        })).toThrow()
    })
})
