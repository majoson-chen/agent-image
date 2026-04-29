import type { ImageModelCapabilities } from '../validation/image-model-schema'

/** 方舟 OpenAPI/LAS 等路径皆可；沿用现有工厂默认以保持兼容 */
export const SEEDREAM_DEFAULT_API_BASE_URL
    = 'https://operator.las.cn-beijing.volces.com/api/v1/online/images/generations'

export type SeedreamPresetKey = 'custom' | '4-5-251128' | '3-0-t2i' | '5-0-lite'

/** 每项对应一条「版本」默认值；模型 ID 以控制台为准，玩具级可做后续对照文档修订 */
export interface SeedreamPreset {
    readonly key: Exclude<SeedreamPresetKey, 'custom'>
    readonly label: string
    readonly modelId: string
    readonly capabilities: ImageModelCapabilities
}

export const SEEDREAM_PRESETS: readonly SeedreamPreset[] = [
    {
        key: '4-5-251128',
        label: 'Seedream 4.5 · doubao-seedream-4-5-251128',
        modelId: 'doubao-seedream-4-5-251128',
        capabilities: {
            supportedSizes: ['1024x1024', '2048x2048'],
            maxReferenceImages: 14,
            supportsSeed: false,
        },
    },
    {
        key: '3-0-t2i',
        label: 'Seedream 3.0 t2i · doubao-seedream-3.0-t2i',
        modelId: 'doubao-seedream-3.0-t2i',
        capabilities: {
            supportedSizes: ['1024x1024', '2048x2048'],
            maxReferenceImages: 0,
            supportsSeed: true,
        },
    },
    {
        key: '5-0-lite',
        label: 'Seedream 5.0 lite · doubao-seedream-5-0-lite-260128（示例 ID）',
        modelId: 'doubao-seedream-5-0-lite-260128',
        capabilities: {
            supportedSizes: ['1024x1024', '2048x2048'],
            maxReferenceImages: 14,
            supportsSeed: false,
        },
    },
]

export function getSeedreamPreset(
    key: Exclude<SeedreamPresetKey, 'custom'>,
): SeedreamPreset {
    const p = SEEDREAM_PRESETS.find(x => x.key === key)
    if (!p)
        throw new Error(`unknown Seedream preset: ${key}`)
    return p
}
