import type { ImageModelCapabilities } from '../../lib/validation/image-model-schema'
import { listModels } from '../../lib/db/models'
import prisma from '../../lib/prisma'
import { AddImageModelForm } from './AddImageModelForm'
import { ImageModelActions } from './ImageModelActions'

export async function ImageModelList() {
    const models = await listModels(prisma, 'IMAGE')

    return (
        <div className="flex flex-col gap-4">
            {models.length === 0 && (
                <p className="text-sm text-base-content/50">尚未添加 Seedream 生图模型</p>
            )}

            {models.map((m) => {
                const cap = m.capabilities as ImageModelCapabilities | null
                return (
                    <div key={m.id} className="rounded-box border border-base-300 bg-base-200 p-4">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate font-medium text-base-content font-mono text-sm">{m.name}</p>
                                <p className="mt-0.5 text-xs text-base-content/50">
                                    火山方舟 Seedream
                                    {cap && (
                                        <>
                                            {' · 分辨率：'}
                                            {cap.supportedSizes?.join(', ')}
                                            {' · 参考图：'}
                                            {cap.maxReferenceImages ?? 0}
                                            张
                                        </>
                                    )}
                                </p>
                            </div>
                            <ImageModelActions id={m.id} />
                        </div>
                    </div>
                )
            })}

            <AddImageModelForm />
        </div>
    )
}
