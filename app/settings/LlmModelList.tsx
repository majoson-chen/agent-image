import { listModels } from '@lib/db/models'
import prisma from '@lib/prisma'
import { getRegisterMetadata } from '@lib/providers/register-metadata'
import { AddLlmModelForm } from './AddLlmModelForm'
import { LlmModelActions } from './LlmModelActions'

function configRecord(config: unknown): Record<string, unknown> {
    return config != null && typeof config === 'object' && !Array.isArray(config)
        ? config as Record<string, unknown>
        : {}
}

export async function LlmModelList() {
    const models = await listModels(prisma, 'LLM')

    return (
        <div className="flex flex-col gap-4">
            {models.length === 0 && (
                <p className="text-sm text-base-content/50">尚未添加 LLM 模型</p>
            )}

            {models.map(m => (
                <div key={m.id} className="rounded-box border border-base-300 bg-base-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="truncate font-medium text-base-content">{m.name}</p>
                            <p className="mt-0.5 text-xs text-base-content/50">
                                {getRegisterMetadata(m.registerId)?.title ?? m.registerId}
                                {typeof configRecord(m.config).modelId === 'string' ? ` · ${configRecord(m.config).modelId}` : ''}
                                {typeof configRecord(m.config).baseURL === 'string' ? ` · ${configRecord(m.config).baseURL}` : ''}
                            </p>
                        </div>
                        <LlmModelActions id={m.id} />
                    </div>
                </div>
            ))}

            <AddLlmModelForm />
        </div>
    )
}
