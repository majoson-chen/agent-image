import type { MockedFunction } from 'vitest'
import type { z } from 'zod'
import type { executeImageGeneration as ExecuteImageGenerationFn } from '../../lib/image-provider-factory'
import type { readImageBuffer as ReadImageBufferFn } from '../../lib/images/storage'
/**
 * U7 — image-generate tool 单测（test-first）
 * 验证动态 input schema、needsApproval、execute 代理逻辑
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createImageGenerateTool } from '../../lib/tools/image-generate'

vi.mock('../../lib/images/storage', () => ({
    readImageBuffer: vi.fn(),
    imagePath: vi.fn(),
    writeImage: vi.fn(),
    deleteImage: vi.fn(),
    deleteConversationImages: vi.fn(),
}))

// mock executeImageGeneration
vi.mock('../../lib/image-provider-factory', () => ({
    executeImageGeneration: vi.fn().mockResolvedValue({
        imageId: 'img-001',
        mimeType: 'image/png',
        width: 2048,
        height: 2048,
        sizeBytes: 12345,
    }),
}))

function makeModel(overrides: Partial<{
    id: string
    name: string
    apiKey: string
    providerType: string
    maxReferenceImages: number
}> = {}) {
    const maxRefs = overrides.maxReferenceImages ?? 4
    return {
        id: overrides.id ?? 'model-1',
        type: 'IMAGE' as const,
        name: overrides.name ?? 'doubao-seedream-4-5-251128',
        providerType: (overrides.providerType ?? 'VOLCENGINE_SEEDREAM') as 'VOLCENGINE_SEEDREAM' | 'DASHSCOPE_WAN_IMAGE',
        apiKey: overrides.apiKey ?? 'test-key',
        baseURL: null,
        contextWindow: null,
        extraHeaders: null,
        capabilities: {
            supportedSizes: ['1024x1024', '2048x2048'],
            maxReferenceImages: maxRefs,
            supportsSeed: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
    }
}

describe('createImageGenerateTool - schema', () => {
    it('includes referenceImageIds when maxReferenceImages > 0', () => {
        const tool = createImageGenerateTool({
            model: makeModel({ maxReferenceImages: 14 }),
            params: { size: '2048x2048' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })
        const schema = tool.inputSchema as z.ZodObject<z.ZodRawShape>
        const shape = schema.shape
        expect(shape.prompt).toBeDefined()
        expect(shape.referenceImageIds).toBeDefined()

        // max 14
        const result = schema.safeParse({
            prompt: 'test',
            referenceImageIds: Array.from({ length: 15 }).fill('clabcdefghijklmnop123456'),
        })
        expect(result.success).toBe(false)

        // 14 ids passes (each id must be cuid-like but we just test array length)
        // Actually z.string().cuid() requires CUID format; let's test with valid ones
        // Just test that referenceImageIds field exists and max is enforced
    })

    it('does not include referenceImageIds when maxReferenceImages = 0', () => {
        const tool = createImageGenerateTool({
            model: makeModel({ maxReferenceImages: 0 }),
            params: { size: '2048x2048' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })
        const schema = tool.inputSchema as z.ZodObject<z.ZodRawShape>
        const shape = schema.shape
        expect(shape.prompt).toBeDefined()
        expect(shape.referenceImageIds).toBeUndefined()

        // parse without referenceImageIds still works
        const result = schema.safeParse({ prompt: 'hello' })
        expect(result.success).toBe(true)
    })

    it('requires prompt min length 1', () => {
        const tool = createImageGenerateTool({
            model: makeModel(),
            params: { size: '1024x1024' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })
        const schema = tool.inputSchema as z.ZodObject<z.ZodRawShape>
        expect(schema.safeParse({ prompt: '' }).success).toBe(false)
        expect(schema.safeParse({ prompt: 'ok' }).success).toBe(true)
    })
})

describe('createImageGenerateTool - needsApproval', () => {
    it('needsApproval is true', () => {
        const tool = createImageGenerateTool({
            model: makeModel(),
            params: { size: '2048x2048' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })
        expect(tool.needsApproval).toBe(true)
    })
})

describe('createImageGenerateTool - description', () => {
    it('pRIMARY description mentions 主生图', () => {
        const tool = createImageGenerateTool({
            model: makeModel(),
            params: { size: '2048x2048' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })
        expect(tool.description).toContain('主生图')
    })

    it('sECONDARY description mentions 次生图', () => {
        const tool = createImageGenerateTool({
            model: makeModel(),
            params: { size: '2048x2048' },
            role: 'SECONDARY',
            conversationId: 'conv-1',
        })
        expect(tool.description).toContain('次生图')
    })
})

describe('createImageGenerateTool - execute', () => {
    beforeAll(() => {
        vi.clearAllMocks()
    })

    afterAll(() => {
        vi.restoreAllMocks()
    })

    it('calls executeImageGeneration with correct params including size from params', async () => {
        const { executeImageGeneration } = await import('../../lib/image-provider-factory')
        const model = makeModel()
        const tool = createImageGenerateTool({
            model,
            params: { size: '1024x1024' },
            role: 'PRIMARY',
            conversationId: 'conv-abc',
        })

        const controller = new AbortController()
        const result = await tool.execute!({ prompt: 'A corgi surfing' }, { abortSignal: controller.signal } as Parameters<NonNullable<typeof tool.execute>>[1])

        expect(executeImageGeneration).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'A corgi surfing',
            size: '1024x1024',
            conversationId: 'conv-abc',
        }))
        expect(result).toMatchObject({ imageId: 'img-001' })
    })

    it('propagates error from executeImageGeneration', async () => {
        const mod = await import('../../lib/image-provider-factory')
        ;(mod.executeImageGeneration as MockedFunction<typeof ExecuteImageGenerationFn>).mockRejectedValueOnce(new Error('Seedream 503'))

        const tool = createImageGenerateTool({
            model: makeModel(),
            params: { size: '2048x2048' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })

        await expect(
            tool.execute!({ prompt: 'test' }, { abortSignal: new AbortController().signal } as Parameters<NonNullable<typeof tool.execute>>[1]),
        ).rejects.toThrow('Seedream 503')
    })
})

describe('createImageGenerateTool - toModelOutput', () => {
    it('returns content with image-data when image file exists', async () => {
        const { readImageBuffer } = await import('../../lib/images/storage')
        const pngBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        ;(readImageBuffer as MockedFunction<typeof readImageBuffer>).mockResolvedValueOnce(pngBuf)

        const tool = createImageGenerateTool({
            model: makeModel(),
            params: { size: '1024x1024' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })

        const output = await (tool as { toModelOutput?: (o: object) => Promise<unknown> }).toModelOutput!({
            toolCallId: 'tc-1',
            input: { prompt: 'test' },
            output: { imageId: 'img-001', mimeType: 'image/png', sizeBytes: 8 },
        })

        expect(output).toMatchObject({
            type: 'content',
            value: [
                { type: 'image-data', data: pngBuf.toString('base64'), mediaType: 'image/png' },
            ],
        })
    })

    it('falls back to json output when image file read fails', async () => {
        const { readImageBuffer } = await import('../../lib/images/storage')
        ;(readImageBuffer as MockedFunction<typeof readImageBuffer>).mockRejectedValueOnce(new Error('ENOENT'))

        const tool = createImageGenerateTool({
            model: makeModel(),
            params: { size: '1024x1024' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })

        const toolOutput = { imageId: 'img-001', mimeType: 'image/png', sizeBytes: 8 }
        const output = await (tool as { toModelOutput?: (o: object) => Promise<unknown> }).toModelOutput!({
            toolCallId: 'tc-1',
            input: { prompt: 'test' },
            output: toolOutput,
        })

        expect(output).toMatchObject({ type: 'json', value: toolOutput })
    })
})
