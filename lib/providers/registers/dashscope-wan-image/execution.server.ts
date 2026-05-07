import type { ExecuteImageGenerationInput } from '@lib/providers/registers/_shared/image-execution-types'

/**
 * dashscope/wan-image：HTTP 请求、响应解析与落盘（Hook：image.execution）。
 */
import type { DashscopeWanImageConfig } from '@lib/providers/registers/dashscope-wan-image'
import { createImage } from '@lib/db/images'
import { WAN_IMAGE_DEFAULT_API_URL } from '@lib/image/wan-image-presets'
import { detectMime } from '@lib/images/mime'
import 'server-only'

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

export async function executeDashscopeWanImageGeneration(
    input: ExecuteImageGenerationInput,
    config: DashscopeWanImageConfig,
) {
    const { model, prompt, size, conversationId, prisma, abortSignal, referenceImages } = input

    const timeoutSignal = AbortSignal.timeout(120_000)
    const combinedSignal = abortSignal
        ? AbortSignal.any([abortSignal, timeoutSignal])
        : timeoutSignal

    const content: Array<{ text?: string, image?: string }> = []

    for (const ref of referenceImages ?? []) {
        content.push({
            image: `data:${ref.mimeType};base64,${ref.base64}`,
        })
    }
    content.push({ text: prompt })

    const parameters: Record<string, unknown> = {
        size: mapSizeToDashscopeParameter(size, config.requestModel),
        n: 1,
        watermark: false,
        thinking_mode: true,
    }

    const body = {
        model: config.requestModel,
        input: {
            messages: [{
                role: 'user',
                content,
            }],
        },
        parameters,
    }

    const apiUrl = config.baseURL?.trim() || WAN_IMAGE_DEFAULT_API_URL

    const res = await fetch(apiUrl, {
        method: 'POST',
        signal: combinedSignal,
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
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
