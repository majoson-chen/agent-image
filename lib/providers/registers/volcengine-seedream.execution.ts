import type { ExecuteImageGenerationInput } from '@lib/providers/registers/image-execution-types'
/**
 * volcengine/seedream：HTTP 请求、响应解析与落盘（Hook：image.execution）。
 */
import type { VolcengineSeedreamConfig } from '@lib/providers/registers/volcengine-seedream'
import { createImage } from '@lib/db/images'
import { SEEDREAM_DEFAULT_API_BASE_URL } from '@lib/image/seedream-presets'
import { detectMime } from '@lib/images/mime'
import 'server-only'

export async function executeVolcengineSeedreamImageGeneration(
    input: ExecuteImageGenerationInput,
    config: VolcengineSeedreamConfig,
) {
    const { model, prompt, size, conversationId, prisma, abortSignal } = input

    const timeoutSignal = AbortSignal.timeout(30_000)
    const combinedSignal = abortSignal
        ? AbortSignal.any([abortSignal, timeoutSignal])
        : timeoutSignal

    const body: Record<string, unknown> = { model: config.requestModel, prompt, size }

    const apiUrl = config.baseURL?.trim() || SEEDREAM_DEFAULT_API_BASE_URL

    const res = await fetch(
        apiUrl,
        {
            method: 'POST',
            signal: combinedSignal,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
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

    const url = extractSeedreamUrl(json)
    if (!url)
        throw new Error('Seedream response missing image URL')

    const downloadRes = await fetch(url, { signal: combinedSignal })
    if (!downloadRes.ok)
        throw new Error(`download ${downloadRes.status}`)

    const buffer = Buffer.from(await downloadRes.arrayBuffer())

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
