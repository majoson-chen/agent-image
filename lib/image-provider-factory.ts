import type { PrismaClient } from '~/generated/prisma/client'
import { createImage } from './db/images'
import { SEEDREAM_DEFAULT_API_BASE_URL } from './image/seedream-presets'
import { WAN_IMAGE_DEFAULT_API_URL } from './image/wan-image-presets'
import { detectMime } from './images/mime'
import 'server-only'

interface ImageModelRecord {
    id: string
    name: string
    providerType: string
    apiKey: string
    baseURL?: string | null
}

interface ExecuteImageGenerationInput {
    model: ImageModelRecord
    prompt: string
    size: string
    conversationId: string
    prisma: PrismaClient
    abortSignal?: AbortSignal
}

export async function executeImageGeneration(input: ExecuteImageGenerationInput) {
    const { model } = input

    if (model.providerType === 'VOLCENGINE_SEEDREAM')
        return executeSeedream(input)

    if (model.providerType === 'DASHSCOPE_WAN_IMAGE')
        return executeDashscopeWanImage(input)

    throw new Error(`unsupported image provider: ${model.providerType}`)
}

async function executeSeedream(input: ExecuteImageGenerationInput) {
    const { model, prompt, size, conversationId, prisma, abortSignal } = input

    // 30s 超时复合 abortSignal
    const timeoutSignal = AbortSignal.timeout(30_000)
    const combinedSignal = abortSignal
        ? AbortSignal.any([abortSignal, timeoutSignal])
        : timeoutSignal

    const body: Record<string, unknown> = { model: model.name, prompt, size }

    const apiUrl = model.baseURL?.trim() || SEEDREAM_DEFAULT_API_BASE_URL

    const res = await fetch(
        apiUrl,
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
    const url = extractSeedreamUrl(json)
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

/** 将对话中的 WxH 映射为百炼 parameters.size（1K/2K/4K 或 W*H） */
function mapSizeToDashscopeParameter(size: string, modelName: string): string {
    const trimmedUpper = size.trim().toUpperCase()
    const isPro = /^wan2\.7-image-pro$/i.test(modelName.trim())

    if (trimmedUpper === '1K' || trimmedUpper === '2K' || trimmedUpper === '4K') {
        if (trimmedUpper === '4K' && !isPro)
            return '2K'
        return trimmedUpper
    }

    const xy = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim())
    if (xy) {
        const w = Number(xy[1])
        const h = Number(xy[2])
        if (w === h) {
            if (w === 1024)
                return '1K'
            if (w === 2048)
                return '2K'
            if (w === 4096) {
                if (!isPro)
                    return '2K'
                return '4K'
            }
        }
        return `${w}*${h}`
    }

    return '2K'
}

async function executeDashscopeWanImage(input: ExecuteImageGenerationInput) {
    const { model, prompt, size, conversationId, prisma, abortSignal } = input

    const timeoutSignal = AbortSignal.timeout(120_000)
    const combinedSignal = abortSignal
        ? AbortSignal.any([abortSignal, timeoutSignal])
        : timeoutSignal

    const content: Array<{ text?: string, image?: string }> = [{ text: prompt }]

    const parameters: Record<string, unknown> = {
        size: mapSizeToDashscopeParameter(size, model.name),
        n: 1,
        watermark: false,
        thinking_mode: true,
    }

    const body = {
        model: model.name,
        input: {
            messages: [{
                role: 'user',
                content,
            }],
        },
        parameters,
    }

    const apiUrl = model.baseURL?.trim() || WAN_IMAGE_DEFAULT_API_URL

    const res = await fetch(apiUrl, {
        method: 'POST',
        signal: combinedSignal,
        headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    const rawText = await res.text().catch(() => '')
    let json: Record<string, unknown>
    try {
        json = rawText ? JSON.parse(rawText) as Record<string, unknown> : {}
    }
    catch {
        throw new Error(`DashScope ${res.status}: invalid JSON`)
    }

    if (!res.ok) {
        const msg = typeof json.message === 'string' ? json.message : rawText
        throw new Error(`DashScope ${res.status}: ${msg}`)
    }

    if (typeof json.code === 'string' && json.output == null && json.message != null) {
        throw new Error(`DashScope ${json.code}: ${json.message}`)
    }

    const url = extractDashscopeImageUrl(json)
    if (!url)
        throw new Error('DashScope response missing image URL')

    const downloadRes = await fetch(url, { signal: combinedSignal })
    if (!downloadRes.ok)
        throw new Error(`download ${downloadRes.status}`)

    const dlBuffer = Buffer.from(await downloadRes.arrayBuffer())

    const mimeType = detectMime(dlBuffer) ?? 'image/png'
    const image = await createImage(prisma, {
        conversationId,
        source: 'GENERATED',
        mimeType,
        sizeBytes: dlBuffer.length,
        modelIdAtTime: model.id,
        buffer: dlBuffer,
    })

    return { imageId: image.id, mimeType, sizeBytes: dlBuffer.length }
}

function extractSeedreamUrl(json: Record<string, unknown>): string | null {
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

function extractDashscopeImageUrl(json: Record<string, unknown>): string | null {
    const output = json.output as Record<string, unknown> | undefined
    const choices = output?.choices as Array<Record<string, unknown>> | undefined
    const message = choices?.[0]?.message as { content?: Array<{ image?: string, type?: string }> } | undefined
    for (const part of message?.content ?? []) {
        if (typeof part.image === 'string')
            return part.image
    }
    return null
}
