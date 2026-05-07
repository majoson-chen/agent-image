import type { CreateImageGenerateToolOptions } from '@lib/tools/registers/image/image-generate-tool-types'
/**
 * IMAGE 生图 tool 入口：按 `model.registerId` 委派 Register 旁实现。
 */
import { createDashscopeWanImageGenerateTool } from '@lib/tools/registers/image/dashscope-wan-generate-tool'
import { createVolcengineSeedreamImageGenerateTool } from '@lib/tools/registers/image/volcengine-seedream-generate-tool'
import 'server-only'

export type { CreateImageGenerateToolOptions }

export function createImageGenerateTool(opts: CreateImageGenerateToolOptions) {
    const { registerId } = opts.model

    if (registerId === 'volcengine/seedream')
        return createVolcengineSeedreamImageGenerateTool(opts)

    if (registerId === 'dashscope/wan-image')
        return createDashscopeWanImageGenerateTool(opts)

    throw new Error(`unsupported image generate registerId: ${registerId}`)
}
