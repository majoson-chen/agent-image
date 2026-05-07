/**
 * Provider 注册表类型：RegisterId 品牌与元数据行形状（plan-01，无 DB）。
 */
import type { ModelType } from '~/generated/prisma/client'

export type RegisterId = string & { readonly __brand: 'RegisterId' }

export interface RegisterMetadata {
    registerId: RegisterId
    modelType: ModelType
    title: string
    description?: string
    sortOrder: number
    /** 仅 IMAGE：设置页选用何种预设组件；未设则表单用通用字段 */
    imagePresetKind?: 'wan' | 'seedream'
}
