/**
 * 会话内生图：`executeImageGeneration` 仅从 Catalog IMAGE 行的 **image.execution** 钩子派发，
 * 无 `switch(registerId)`。为避免 `registry` ↔ 各生图 tool 文件的静态循环依赖，此处对 registry 使用动态 import。
 */
import type {
    ExecuteImageGenerationInput,
    ImageGenerationExecutionResult,
} from '@lib/providers/registers/_shared/image-execution-types'

import 'server-only'

export type {
    ExecuteImageGenerationInput,
    ImageGenerationExecutionResult,
} from '@lib/providers/registers/_shared/image-execution-types'

export async function executeImageGeneration(
    input: ExecuteImageGenerationInput,
): Promise<ImageGenerationExecutionResult> {
    const { getImageCatalogRowStrict } = await import('@lib/providers/registry')
    const row = getImageCatalogRowStrict(input.model.registerId)
    return row.executeImageGeneration(input)
}
