import { describe, expect, it } from 'vitest'
import { handleRegisterMetadataGet } from '~/app/api/register-metadata/route'

describe('register-metadata GET', () => {
    it('returns LLM registers only', async () => {
        const params = new URLSearchParams({ type: 'LLM' })
        const res = await handleRegisterMetadataGet(params)
        expect(res.status).toBe(200)
        const body = await res.json() as Array<{ registerId: string, modelType: string }>
        expect(body.every(x => x.modelType === 'LLM')).toBe(true)
        expect(body.some(x => x.registerId === 'openai/official')).toBe(true)
        expect(body.some(x => x.registerId === 'brave/search')).toBe(false)
    })

    it('returns 400 for invalid type query', async () => {
        const params = new URLSearchParams({ type: 'FOO' })
        const res = await handleRegisterMetadataGet(params)
        expect(res.status).toBe(400)
    })
})
