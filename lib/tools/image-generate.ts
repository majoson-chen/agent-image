import type { CreateImageGenerateToolOptions } from '@lib/tools/registers/image/image-generate-tool-types'
/**
 * IMAGE 生图 tool 入口：按 Catalog `createImageGenerateTool` 派发。
 */
import { getImageCatalogRowStrict } from '@lib/providers/registry'
import 'server-only'

export type { CreateImageGenerateToolOptions }

export function createImageGenerateTool(opts: CreateImageGenerateToolOptions) {
    const row = getImageCatalogRowStrict(opts.model.registerId)
    return row.createImageGenerateTool(opts)
}
