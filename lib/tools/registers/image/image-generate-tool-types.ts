import type { Model } from '~/generated/prisma/client'

export interface CreateImageGenerateToolOptions {
    model: Model
    params: { size: string }
    role: 'PRIMARY' | 'SECONDARY'
    conversationId: string
}
