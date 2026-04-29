import { listModels } from '../../lib/db/models'
import prisma from '../../lib/prisma'
import { AddSearchModelForm } from './AddSearchModelForm'
import { SearchModelActions } from './SearchModelActions'

export async function SearchModelList() {
    const models = await listModels(prisma, 'SEARCH')

    return (
        <div className="flex flex-col gap-4">
            {models.length === 0 && (
                <p className="text-sm text-base-content/50">尚未添加 Brave Search 模型</p>
            )}

            {models.map(m => (
                <div key={m.id} className="rounded-box border border-base-300 bg-base-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="truncate font-medium text-base-content">{m.name}</p>
                            <p className="mt-0.5 text-xs text-base-content/50">
                                Brave Search · Token: ****
                            </p>
                        </div>
                        <SearchModelActions id={m.id} />
                    </div>
                </div>
            ))}

            <AddSearchModelForm />
        </div>
    )
}
