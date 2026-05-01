import {
    extractImageFetchBatchesFromStep,
    normalizeImageFetchOutput,
    parseImageFetchToolOutput,
    unwrapToolOutput,
} from '@lib/ai/image-fetch-vision-injection'
import { describe, expect, it } from 'vitest'

describe('unwrapToolOutput', () => {
    it('unwraps json envelope', () => {
        expect(unwrapToolOutput({ type: 'json', value: { a: 1 } })).toEqual({ a: 1 })
    })
    it('returns plain object unchanged', () => {
        expect(unwrapToolOutput({ imageId: 'x' })).toEqual({ imageId: 'x' })
    })
})

describe('parseImageFetchToolOutput', () => {
    it('legacy single imageId + mimeType', () => {
        expect(parseImageFetchToolOutput({ imageId: 'u1', mimeType: 'image/png' })).toEqual({
            successes: [{ imageId: 'u1', mimeType: 'image/png' }],
            failureNotes: [],
        })
    })

    it('items[]: successes in index order', () => {
        expect(
            parseImageFetchToolOutput({
                items: [
                    { index: 2, ok: true, imageId: 'b', mimeType: 'image/jpeg' },
                    { index: 0, ok: true, imageId: 'a', mimeType: 'image/png' },
                ],
            }),
        ).toEqual({
            successes: [
                { imageId: 'a', mimeType: 'image/png' },
                { imageId: 'b', mimeType: 'image/jpeg' },
            ],
            failureNotes: [],
        })
    })

    it('items[]: failures become failureNotes', () => {
        const r = parseImageFetchToolOutput({
            items: [
                { index: 0, ok: true, imageId: 'a', mimeType: 'image/png' },
                { index: 1, ok: false, error: 'boom' },
            ],
        })
        expect(r.successes).toEqual([{ imageId: 'a', mimeType: 'image/png' }])
        expect(r.failureNotes).toEqual(['sources[1]: boom'])
    })

    it('unwraps json envelope before parse', () => {
        expect(parseImageFetchToolOutput({ type: 'json', value: { imageId: 'u2', mimeType: 'image/jpeg' } })).toEqual({
            successes: [{ imageId: 'u2', mimeType: 'image/jpeg' }],
            failureNotes: [],
        })
    })
})

describe('normalizeImageFetchOutput (alias)', () => {
    it('returns only successes list', () => {
        expect(
            normalizeImageFetchOutput({
                items: [
                    { index: 0, ok: true, imageId: 'a', mimeType: 'image/png' },
                    { index: 1, ok: false, error: 'x' },
                ],
            }),
        ).toEqual([{ imageId: 'a', mimeType: 'image/png' }])
    })
})

describe('extractImageFetchBatchesFromStep', () => {
    it('collects batches with failureNotes attached to successes', () => {
        const batches = extractImageFetchBatchesFromStep({
            content: [
                {
                    type: 'tool-result',
                    toolName: 'image-fetch',
                    toolCallId: 'call-a',
                    output: {
                        items: [
                            { index: 0, ok: false, error: 'bad url' },
                            { index: 1, ok: true, imageId: 'img-1', mimeType: 'image/png' },
                        ],
                    },
                },
            ],
        })
        expect(batches).toHaveLength(1)
        expect(batches[0]).toMatchObject({
            toolCallId: 'call-a',
            images: [{ imageId: 'img-1', mimeType: 'image/png' }],
            failureNotes: ['sources[0]: bad url'],
        })
    })

    it('legacy flat output → one batch without failureNotes', () => {
        const batches = extractImageFetchBatchesFromStep({
            content: [
                {
                    type: 'tool-result',
                    toolName: 'image-fetch',
                    toolCallId: 'call-legacy',
                    output: { imageId: 'img-1', mimeType: 'image/png' },
                },
            ],
        })
        expect(batches).toHaveLength(1)
        expect(batches[0]!.failureNotes).toHaveLength(0)
    })

    it('skip when all items failed', () => {
        const batches = extractImageFetchBatchesFromStep({
            content: [
                {
                    type: 'tool-result',
                    toolName: 'image-fetch',
                    toolCallId: 'call-x',
                    output: { items: [{ index: 0, ok: false, error: 'nope' }] },
                },
            ],
        })
        expect(batches).toHaveLength(0)
    })
})
