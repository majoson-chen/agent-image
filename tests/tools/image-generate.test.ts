import type { executeImageGeneration as ExecuteImageGenerationFn } from '@lib/image-provider-factory'
import type { MockedFunction } from 'vitest'
import type { z } from 'zod'
import { createImageGenerateTool } from '@lib/tools/image-generate'
/**
 * U7 — image-generate tool 单测（test-first）
 * 验证动态 input schema、needsApproval、execute 代理逻辑
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

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
    registerId: string
    maxReferenceImages: number
}> = {}) {
    const maxRefs = overrides.maxReferenceImages ?? 4
    return {
        id: overrides.id ?? 'model-1',
        type: 'IMAGE' as const,
        name: overrides.name ?? 'doubao-seedream-4-5-251128',
        registerId: overrides.registerId ?? 'volcengine/seedream',
        config: {
            requestModel: overrides.name ?? 'doubao-seedream-4-5-251128',
            apiKey: 'test-key',
            capabilities: {
                supportedSizes: ['1024x1024', '2048x2048'],
                maxReferenceImages: maxRefs,
                supportsSeed: false,
            },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
    }
}

describe('createImageGenerateTool - schema', () => {
    it('dashscope wan with maxReferenceImages exposes optional capped referenceImageIds', () => {
        const wan = createImageGenerateTool({
            model: makeModel({ registerId: 'dashscope/wan-image', maxReferenceImages: 3 }),
            params: { size: '2048x2048' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })
        const sch = wan.inputSchema as z.ZodObject<z.ZodRawShape>
        expect(sch.shape.referenceImageIds).toBeDefined()
        expect(
            sch.safeParse({ prompt: 'x', referenceImageIds: ['a', 'b', 'c', 'd'] }).success,
        ).toBe(false)
        expect(sch.safeParse({ prompt: 'x', referenceImageIds: ['a', 'b', 'c'] }).success).toBe(true)
    })

    it('seedream omits referenceImageIds even when maxReferenceImages positive', () => {
        const highRefModel = createImageGenerateTool({
            model: makeModel({
                registerId: 'volcengine/seedream',
                maxReferenceImages: 14,
            }),
            params: { size: '2048x2048' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })
        const highSchema = highRefModel.inputSchema as z.ZodObject<z.ZodRawShape>
        expect(highSchema.shape.prompt).toBeDefined()
        expect(highSchema.shape.referenceImageIds).toBeUndefined()
    })

    it('dashscope wan with maxReferenceImages 0 hides reference ids', () => {
        const noRefTool = createImageGenerateTool({
            model: makeModel({
                registerId: 'dashscope/wan-image',
                maxReferenceImages: 0,
            }),
            params: { size: '2048x2048' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })
        expect((noRefTool.inputSchema as z.ZodObject<z.ZodRawShape>).shape.referenceImageIds).toBeUndefined()
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

    it('returns structured error from executeImageGeneration', async () => {
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
        ).resolves.toMatchObject({
            ok: false,
            code: 'IMAGE_GEN_FAILED',
            message: 'Seedream 503',
        })
    })

    it('redacts api-key-looking substrings from error message', async () => {
        const mod = await import('../../lib/image-provider-factory')
        ;(mod.executeImageGeneration as MockedFunction<typeof ExecuteImageGenerationFn>).mockRejectedValueOnce(
            new Error(`Bad gateway sk-${'a'.repeat(20)} end`),
        )

        const tool = createImageGenerateTool({
            model: makeModel(),
            params: { size: '2048x2048' },
            role: 'PRIMARY',
            conversationId: 'conv-1',
        })

        const out = await tool.execute!({ prompt: 'test' }, { abortSignal: new AbortController().signal } as Parameters<NonNullable<typeof tool.execute>>[1])
        expect(out.ok).toBe(false)
        expect((out as { message: string }).message).not.toContain('sk-aaaaaaaa')
        expect((out as { message: string }).message).toContain('[redacted]')
    })
})
