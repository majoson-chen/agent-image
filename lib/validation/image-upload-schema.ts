import { z } from 'zod'

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB

export const imageUploadSchema = z.object({
    conversationId: z.string().min(1, '对话 ID 必填'),
    mimeType: z.string().refine(
        mime => ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'].includes(mime),
        { message: '不支持的图像类型' },
    ),
    sizeBytes: z.number().int().min(1, '文件为空').max(MAX_UPLOAD_BYTES, '文件过大'),
})
