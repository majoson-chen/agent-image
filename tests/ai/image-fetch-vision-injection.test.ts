import {
    extractImageFetchBatchesFromRunningParts,
    extractImageFetchBatchesFromStep,
    mergeImageFetchBatchesForPersist,
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

    it('resolves toolName from preceding tool-call when tool-result omits toolName', () => {
        const batches = extractImageFetchBatchesFromStep({
            content: [
                { type: 'tool-call', toolName: 'image-fetch', toolCallId: 'call-x', input: {} },
                {
                    type: 'tool-result',
                    toolCallId: 'call-x',
                    output: { imageId: 'img-1', mimeType: 'image/png' },
                },
            ],
        })
        expect(batches).toHaveLength(1)
        expect(batches[0]!.toolCallId).toBe('call-x')
        expect(batches[0]!.images).toEqual([{ imageId: 'img-1', mimeType: 'image/png' }])
    })
})

describe('extractImageFetchBatchesFromRunningParts', () => {
    it('parses dynamic-tool image-fetch output-available parts', () => {
        const batches = extractImageFetchBatchesFromRunningParts([
            {
                type: 'dynamic-tool',
                toolName: 'image-fetch',
                state: 'output-available',
                toolCallId: 'dyn-1',
                output: { imageId: 'a', mimeType: 'image/png' },
            },
        ])
        expect(batches).toHaveLength(1)
        expect(batches[0]!.toolCallId).toBe('dyn-1')
        expect(batches[0]!.images).toEqual([{ imageId: 'a', mimeType: 'image/png' }])
    })

    it('parses tool-image-fetch output-available parts', () => {
        const batches = extractImageFetchBatchesFromRunningParts([
            { type: 'step-start' },
            {
                type: 'tool-image-fetch',
                state: 'output-available',
                toolCallId: 'call-1',
                output: { imageId: 'img-x', mimeType: 'image/png' },
            },
        ])
        expect(batches).toEqual([
            {
                toolCallId: 'call-1',
                images: [{ imageId: 'img-x', mimeType: 'image/png' }],
                failureNotes: [],
            },
        ])
    })

    it('ignores input-available and other tools', () => {
        expect(extractImageFetchBatchesFromRunningParts([
            { type: 'tool-image-fetch', state: 'input-available', toolCallId: 'c' },
            { type: 'tool-web-fetch', state: 'output-available', toolCallId: 'w', output: {} },
        ])).toHaveLength(0)
    })
})

describe('mergeImageFetchBatchesForPersist', () => {
    it('fills from runningParts when step.content has no tool-result', () => {
        const merged = mergeImageFetchBatchesForPersist(
            { content: [{ type: 'text', text: 'done' }] },
            [
                {
                    type: 'tool-image-fetch',
                    state: 'output-available',
                    toolCallId: 'from-parts',
                    output: { imageId: 'z', mimeType: 'image/jpeg' },
                },
            ],
        )
        expect(merged).toHaveLength(1)
        expect(merged[0]!.toolCallId).toBe('from-parts')
        expect(merged[0]!.images).toEqual([{ imageId: 'z', mimeType: 'image/jpeg' }])
    })

    it('prefers step.content when both have same toolCallId', () => {
        const merged = mergeImageFetchBatchesForPersist(
            {
                content: [
                    {
                        type: 'tool-result',
                        toolName: 'image-fetch',
                        toolCallId: 'same',
                        output: { imageId: 'from-step', mimeType: 'image/png' },
                    },
                ],
            },
            [
                {
                    type: 'tool-image-fetch',
                    state: 'output-available',
                    toolCallId: 'same',
                    output: { imageId: 'from-running', mimeType: 'image/png' },
                },
            ],
        )
        expect(merged).toHaveLength(1)
        expect(merged[0]!.images[0]!.imageId).toBe('from-step')
    })
})
