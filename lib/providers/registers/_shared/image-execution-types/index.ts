/**
 * 生图执行体共享入参（Register 旁 execution 模块与门面共用）。
 */
import type { PrismaClient } from '~/generated/prisma/client'

export interface ImageModelRecord {
    id: string
    registerId: string
    config: unknown
}

export interface ExecuteImageGenerationInput {
    model: ImageModelRecord
    prompt: string
    size: string
    conversationId: string
    prisma: PrismaClient
    abortSignal?: AbortSignal
    /** 仅万相多模态：已通过会话校验的参考图 */
    referenceImages?: Array<{ mimeType: string, base64: string }>
}

/** 各 IMAGE Register 的 `image.execution` 成功返回值（落盘后的统一形状） */
export interface ImageGenerationExecutionResult {
    imageId: string
    mimeType: string
    sizeBytes: number
}
