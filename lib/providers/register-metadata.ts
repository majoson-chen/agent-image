/**
 * 客户端安全：仅从 `register-config` 派生元数据与 `parseModelConfig`，不引用 LLM / IMAGE / SEARCH 运行时工厂（避免 Client Component 经 `registry` 拉取 `server-only` 与 Prisma）。
 */
import type { RegisterId, RegisterMetadata } from '@lib/providers/types'
import type { ModelType } from '~/generated/prisma/client'
import { REGISTER_CONFIG_CATALOG } from '@lib/providers/register-config'

export { parseModelConfig } from '@lib/providers/register-config'

const REGISTER_METADATA_LIST: readonly RegisterMetadata[] = REGISTER_CONFIG_CATALOG.map(
    ({ schema: _schema, ...meta }) => meta,
)

export const REGISTER_IDS: RegisterId[] = REGISTER_METADATA_LIST.map(row => row.registerId)

export function listRegisterMetadata(modelType: ModelType): RegisterMetadata[] {
    return [...REGISTER_METADATA_LIST]
        .filter(row => row.modelType === modelType)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(row => ({ ...row }))
}

export function getRegisterMetadata(registerId: string): RegisterMetadata | undefined {
    const row = REGISTER_METADATA_LIST.find(m => m.registerId === registerId)
    return row ? { ...row } : undefined
}
