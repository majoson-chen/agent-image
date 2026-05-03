import { buildUserAttachXml, isUserAttachInjectText, USER_ATTACH_XML_TAG } from '@lib/ai/user-attach-xml'
import { describe, expect, it } from 'vitest'

describe('user-attach-xml', () => {
    it('builds xml with sequential slots', () => {
        const xml = buildUserAttachXml([
            { imageId: 'a', mimeType: 'image/png' },
            { imageId: 'b', mimeType: 'image/jpeg' },
        ])
        expect(xml).toContain(`<${USER_ATTACH_XML_TAG}`)
        expect(xml).toMatch(/n="1".*imageId="a"/s)
        expect(xml).toMatch(/n="2".*imageId="b"/s)
    })

    it('detects inject block', () => {
        expect(isUserAttachInjectText(`  <${USER_ATTACH_XML_TAG} version="1">`)).toBe(true)
        expect(isUserAttachInjectText('hello')).toBe(false)
    })

    it('escapes special characters in attributes', () => {
        const xml = buildUserAttachXml([
            { imageId: 'id-with-"-quote', mimeType: 'image/png' },
        ])
        expect(xml).toContain('imageId=')
        expect(xml).not.toContain('imageId="id-with-"-quote"')
        expect(xml).toContain('&quot;')
    })
})
