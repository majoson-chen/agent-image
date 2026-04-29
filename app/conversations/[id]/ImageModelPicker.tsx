'use client'

import type { ImageModelCapabilities } from '../../../lib/validation/image-model-schema'
import { ExternalLink } from 'lucide-react'
import { useTransition } from 'react'
import { setImageSelectionAction } from './imageSelectionActions'

interface ImageModel {
    id: string
    name: string
    capabilities: ImageModelCapabilities | null
}

interface Props {
    conversationId: string
    role: 'IMAGE_PRIMARY' | 'IMAGE_SECONDARY'
    currentModelId: string | null
    currentSize: string | null
    availableModels: ImageModel[]
}

const ROLE_LABEL: Record<Props['role'], string> = {
    IMAGE_PRIMARY: '主生图',
    IMAGE_SECONDARY: '次生图',
}

export function ImageModelPicker({ conversationId, role, currentModelId, currentSize, availableModels }: Props) {
    const [pending, startTransition] = useTransition()
    const label = ROLE_LABEL[role]

    const selectedModel = availableModels.find(m => m.id === currentModelId) ?? null
    const sizes = selectedModel?.capabilities?.supportedSizes ?? []

    function handleModelChange(modelId: string) {
        const model = availableModels.find(m => m.id === modelId) ?? null
        const defaultSize = model?.capabilities?.supportedSizes?.[0] ?? null
        startTransition(() => {
            setImageSelectionAction(conversationId, role, modelId || null, defaultSize)
        })
    }

    function handleSizeChange(size: string) {
        startTransition(() => {
            setImageSelectionAction(conversationId, role, currentModelId, size)
        })
    }

    if (availableModels.length === 0) {
        return (
            <div className="flex min-w-32 flex-col gap-0.5">
                <span className="text-xs text-base-content/50">{label}</span>
                <a href="/settings" className="inline-flex items-center gap-1 text-xs text-primary underline">
                    <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
                    前往设置添加
                </a>
            </div>
        )
    }

    return (
        <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-base-content/50">{label}</span>
            <select
                className="select select-bordered select-sm w-full min-w-44 max-w-[220px]"
                value={currentModelId ?? ''}
                onChange={e => handleModelChange(e.target.value)}
                disabled={pending}
            >
                <option value="">未选</option>
                {availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                ))}
            </select>
            {selectedModel && sizes.length > 0 && (
                <select
                    className="select select-bordered select-xs w-full min-w-44 max-w-[220px]"
                    value={currentSize ?? sizes[0]}
                    onChange={e => handleSizeChange(e.target.value)}
                    disabled={pending}
                >
                    {sizes.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            )}
        </div>
    )
}
