import type { ImageModelCapabilities } from '../validation/image-model-schema'

/** 北京地域同步文生图 / 图生图（与百炼文档一致；新加坡换 dashscope-intl 域名） */
export const WAN_IMAGE_DEFAULT_API_URL
    = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

export type WanImagePresetKey = 'custom' | '2-7-pro' | '2-7'

export interface WanImagePreset {
    readonly key: Exclude<WanImagePresetKey, 'custom'>
    readonly label: string
    readonly modelId: string
    readonly capabilities: ImageModelCapabilities
}

export const WAN_IMAGE_PRESETS: readonly WanImagePreset[] = [
    {
        key: '2-7-pro',
        label: '万相 2.7 image 专业版 · wan2.7-image-pro',
        modelId: 'wan2.7-image-pro',
        capabilities: {
            supportedSizes: ['1024x1024', '2048x2048', '4096x4096'],
            maxReferenceImages: 9,
            supportsSeed: true,
        },
    },
    {
        key: '2-7',
        label: '万相 2.7 image · wan2.7-image',
        modelId: 'wan2.7-image',
        capabilities: {
            supportedSizes: ['1024x1024', '2048x2048'],
            maxReferenceImages: 9,
            supportsSeed: true,
        },
    },
]

export function getWanImagePreset(key: Exclude<WanImagePresetKey, 'custom'>): WanImagePreset {
    const p = WAN_IMAGE_PRESETS.find(x => x.key === key)
    if (!p)
        throw new Error(`unknown Wan image preset: ${key}`)
    return p
}
