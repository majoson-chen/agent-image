import { listModels } from '../../lib/db/models'
import prisma from '../../lib/prisma'
import { AddLlmModelForm } from './AddLlmModelForm'
import { LlmModelActions } from './LlmModelActions'

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
                                {m.providerType}
                                {m.baseURL ? ` · ${m.baseURL}` : ''}
                                {' · '}
                                {((m.contextWindow ?? 0) / 1000).toFixed(0)}
                                k ctx
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
