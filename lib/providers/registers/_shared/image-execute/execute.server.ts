import type { ExecuteImageGenerationInput } from '@lib/providers/registers/_shared/image-execution-types'

/**
 * DEPRECATED surface：`executeImageGeneration` 门面仅供生图 tool 内部调用；
 * 新代码请直接引用各 Register 的 `*.execution` 模块。本文件仅保留 `registerId` + `parseModelConfig` 分发。
 */
import type { DashscopeWanImageConfig } from '@lib/providers/registers/dashscope-wan-image'
import type { VolcengineSeedreamConfig } from '@lib/providers/registers/volcengine-seedream'
import { parseModelConfig } from '@lib/providers/register-config'
import { executeDashscopeWanImageGeneration } from '@lib/providers/registers/dashscope-wan-image/execution.server'
import { executeVolcengineSeedreamImageGeneration } from '@lib/providers/registers/volcengine-seedream/execution.server'
import 'server-only'

export type { ExecuteImageGenerationInput } from '@lib/providers/registers/_shared/image-execution-types'

export async function executeImageGeneration(input: ExecuteImageGenerationInput) {
    const { model } = input

    switch (model.registerId) {
        case 'volcengine/seedream': {
            const config = parseModelConfig(model.registerId, model.config) as VolcengineSeedreamConfig
            return executeVolcengineSeedreamImageGeneration(input, config)
        }
        case 'dashscope/wan-image': {
            const config = parseModelConfig(model.registerId, model.config) as DashscopeWanImageConfig
            return executeDashscopeWanImageGeneration(input, config)
        }
        default:
            throw new Error(`unsupported image register: ${model.registerId}`)
    }
}
