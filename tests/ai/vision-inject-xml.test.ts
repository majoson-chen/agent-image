import {
    buildVisionInjectXml,
    isVisionInjectUserText,
    VISION_INJECT_XML_TAG,
} from '@lib/ai/vision-inject-xml'
import { describe, expect, it } from 'vitest'

describe('buildVisionInjectXml', () => {
    it('wraps batches with root tag and version', () => {
        const xml = buildVisionInjectXml([
            {
                toolCallId: 'call-1',
                images: [{ imageId: 'img-a', mimeType: 'image/png' }],
                failureNotes: [],
            },
        ])
        expect(xml.startsWith(`<${VISION_INJECT_XML_TAG} version="1">`)).toBe(true)
        expect(xml.endsWith(`</${VISION_INJECT_XML_TAG}>`)).toBe(true)
        expect(xml).toContain('<batch toolCallId="call-1">')
        expect(xml).toContain('<slot n="1" imageId="img-a" mimeType="image/png"/>')
    })

    it('global slot n increments across batches', () => {
        const xml = buildVisionInjectXml([
            {
                toolCallId: 'a',
                images: [{ imageId: '1', mimeType: 'image/png' }],
                failureNotes: [],
            },
            {
                toolCallId: 'b',
                images: [
                    { imageId: '2', mimeType: 'image/jpeg' },
                    { imageId: '3', mimeType: 'image/webp' },
                ],
                failureNotes: [],
            },
        ])
        expect(xml).toContain('n="1"')
        expect(xml).toContain('n="2"')
        expect(xml).toContain('n="3"')
    })

    it('escapes failures and attributes', () => {
        const xml = buildVisionInjectXml([
            {
                toolCallId: `call"id`,
                images: [{ imageId: 'x', mimeType: 'image/png' }],
                failureNotes: ['sources[0]: a & b <c>'],
            },
        ])
        expect(xml).toContain('<failure>sources[0]: a &amp; b &lt;c&gt;</failure>')
        expect(xml).toContain('toolCallId="call&quot;id"')
    })
})

describe('isVisionInjectUserText', () => {
    it('true when trimmed text starts with root open tag', () => {
        expect(isVisionInjectUserText(`  <${VISION_INJECT_XML_TAG} version="1">`)).toBe(true)
    })

    it('false for normal user text', () => {
        expect(isVisionInjectUserText('你好')).toBe(false)
    })
})
