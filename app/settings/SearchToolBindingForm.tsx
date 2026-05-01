'use client'

import type { Model } from '~/generated/prisma/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
    searchModels: Model[]
    currentWebSearch: string | null
    currentImageSearch: string | null
}

type SearchTool = 'WEB_SEARCH' | 'IMAGE_SEARCH'

export function SearchToolBindingForm({ searchModels, currentWebSearch, currentImageSearch }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState<SearchTool | null>(null)

    async function handleChange(tool: SearchTool, value: string) {
        setLoading(tool)
        if (value === '') {
            await fetch(`/api/bindings?tool=${tool}`, { method: 'DELETE' })
        }
        else {
            await fetch('/api/bindings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool, modelId: value }),
            })
        }
        setLoading(null)
        router.refresh()
    }

    const noModels = searchModels.length === 0

    return (
        <div className="grid gap-4">
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-base-content">
                    网页搜索（web-search）
                </label>
                <select
                    className="select select-bordered w-full"
                    value={currentWebSearch ?? ''}
                    onChange={e => handleChange('WEB_SEARCH', e.target.value)}
                    disabled={noModels || loading !== null}
                >
                    <option value="">
                        {noModels ? '请先创建 Search 模型' : '— 未绑定 —'}
                    </option>
                    {searchModels.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
                {loading === 'WEB_SEARCH' && (
                    <span className="loading loading-spinner loading-xs mt-1" />
                )}
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-base-content">
                    图像搜索（image-search）
                </label>
                <select
                    className="select select-bordered w-full"
                    value={currentImageSearch ?? ''}
                    onChange={e => handleChange('IMAGE_SEARCH', e.target.value)}
                    disabled={noModels || loading !== null}
                >
                    <option value="">
                        {noModels ? '请先创建 Search 模型' : '— 未绑定 —'}
                    </option>
                    {searchModels.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
                {loading === 'IMAGE_SEARCH' && (
                    <span className="loading loading-spinner loading-xs mt-1" />
                )}
            </div>
        </div>
    )
}
