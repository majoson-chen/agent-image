/**
 * image-fetch 合成 user 在 DB 中排在 assistant 行之后时的模型消息重排。
 */
import {
    interleaveImageFetchVisionForModel,
} from '@lib/ai/interleave-image-fetch-vision-for-model'
import { buildVisionInjectXml } from '@lib/ai/vision-inject-xml'
import { safeValidateUIMessages } from 'ai'
import { describe, expect, it } from 'vitest'

describe('interleaveImageFetchVisionForModel', () => {
    it('将 vision user 插到 assistant 的 tool 与后续 text 之间', async () => {
        const visionText = buildVisionInjectXml([
            {
                toolCallId: 'call-1',
                images: [{ imageId: 'img-a', mimeType: 'image/png' }],
                failureNotes: [],
            },
        ])
        const visionUser = {
            id: 'su1',
            role: 'user' as const,
            parts: [
                { type: 'text', text: visionText },
                { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,xx' },
            ],
        }
        const assistantBefore = {
            id: 'a1',
            role: 'assistant' as const,
            parts: [
                { type: 'step-start' },
                {
                    type: 'tool-image-fetch',
                    state: 'output-available',
                    toolCallId: 'call-1',
                    output: { imageId: 'img-a', mimeType: 'image/png' },
                },
                { type: 'step-start' },
                { type: 'text', text: '描述图像' },
            ],
        }
        const inList = [
            { id: 'u0', role: 'user' as const, parts: [{ type: 'text', text: '拉取图' }] },
            assistantBefore,
            visionUser,
        ]
        const out = interleaveImageFetchVisionForModel(inList)
        expect(out).toHaveLength(4)
        expect(out[0]!.id).toBe('u0')
        expect(out[1]!.id).toBe('a1')
        expect((out[1]!.parts as { type: string }[]).map(p => p.type)).toEqual(['step-start', 'tool-image-fetch'])
        expect(out[2]).toEqual(visionUser)
        expect(out[3]!.role).toBe('assistant')
        expect(out[3]!.id).toContain('__vision_post__')
        expect((out[3]!.parts as { type: string }[]).map(p => p.type)).toEqual(['step-start', 'text'])

        const v = await safeValidateUIMessages({ messages: out })
        expect(v.success).toBe(true)
    })

    it('无后置文本时不切分 assistant', () => {
        const visionText = buildVisionInjectXml([
            {
                toolCallId: 'c2',
                images: [{ imageId: 'i', mimeType: 'image/png' }],
                failureNotes: [],
            },
        ])
        const assistant = {
            id: 'a2',
            role: 'assistant' as const,
            parts: [
                {
                    type: 'tool-image-fetch',
                    state: 'output-available',
                    toolCallId: 'c2',
                    output: { imageId: 'i', mimeType: 'image/png' },
                },
            ],
        }
        const visionUser = {
            id: 'v2',
            role: 'user' as const,
            parts: [
                { type: 'text', text: visionText },
                { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,aa' },
            ],
        }
        const out = interleaveImageFetchVisionForModel([assistant, visionUser])
        expect(out).toHaveLength(2)
        expect(out[0]).toEqual(assistant)
        expect(out[1]).toEqual(visionUser)
    })
})
