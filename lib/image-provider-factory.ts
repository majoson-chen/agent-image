import 'server-only'
import type { PrismaClient } from '../generated/prisma/client'
import { createImage, getImage } from './db/images'
import { detectMime } from './images/mime'
import { readImageBuffer } from './images/storage'

interface ImageModelRecord {
    id: string
    name: string
    providerType: string
    apiKey: string
}

interface ExecuteImageGenerationInput {
    model: ImageModelRecord
    prompt: string
    referenceImageIds: string[]
    size: string
    conversationId: string
    prisma: PrismaClient
    abortSignal: AbortSignal
}

export async function executeImageGeneration(input: ExecuteImageGenerationInput) {
    const { model, prompt, referenceImageIds, size, conversationId, prisma, abortSignal } = input

    if (model.providerType !== 'VOLCENGINE_SEEDREAM')
        throw new Error(`unsupported image provider: ${model.providerType}`)

    return executeSeedream({ model, prompt, referenceImageIds, size, conversationId, prisma, abortSignal })
}

async function executeSeedream(input: ExecuteImageGenerationInput) {
    const { model, prompt, referenceImageIds, size, conversationId, prisma, abortSignal } = input

    // 30s 超时复合 abortSignal
    const timeoutSignal = AbortSignal.timeout(30_000)
    const combinedSignal = AbortSignal.any([abortSignal, timeoutSignal])

    // 1. 把参考图解析为 base64
    const images: string[] = []
    for (const id of referenceImageIds) {
        const img = await getImage(prisma, id)
        if (!img)
            throw new Error(`reference image not found: ${id}`)
        const buffer = await readImageBuffer(img.conversationId, img.id, img.mimeType)
        images.push(`data:${img.mimeType};base64,${buffer.toString('base64')}`)
    }

    // 2. 调用 Seedream API
    const body: Record<string, unknown> = { model: model.name, prompt, size }
    if (images.length === 1) {
        body.image = images[0]
    }
    else if (images.length > 1) {
        body.image = images
    }

    const res = await fetch(
        'https://operator.las.cn-beijing.volces.com/api/v1/online/images/generations',
        {
            method: 'POST',
            signal: combinedSignal,
            headers: {
                'Authorization': `Bearer ${model.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        },
    )

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Seedream ${res.status}: ${text}`)
    }

    const json = await res.json() as Record<string, unknown>

    // 3. 提取 URL（兼容多种响应结构）
    const url = extractUrl(json)
    if (!url)
        throw new Error('Seedream response missing image URL')

    // 4. 下载图像到 buffer
    const downloadRes = await fetch(url, { signal: combinedSignal })
    if (!downloadRes.ok)
        throw new Error(`download ${downloadRes.status}`)

    const buffer = Buffer.from(await downloadRes.arrayBuffer())

    // 5. 探测 mimeType + 落盘 + 创建 DB row
    const mimeType = detectMime(buffer) ?? 'image/png'
    const image = await createImage(prisma, {
        conversationId,
        source: 'GENERATED',
        mimeType,
        sizeBytes: buffer.length,
        modelIdAtTime: model.id,
        buffer,
    })

    return { imageId: image.id, mimeType, sizeBytes: buffer.length }
}

function extractUrl(json: Record<string, unknown>): string | null {
    // 各种可能的响应结构
    const data = json.data as Array<Record<string, unknown>> | undefined
    if (data?.[0]?.url)
        return data[0].url as string

    const images = json.images as Array<Record<string, unknown>> | undefined
    if (images?.[0]?.url)
        return images[0].url as string

    if (typeof json.url === 'string')
        return json.url

    return null
}
