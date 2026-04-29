'use client'

import { useTransition } from 'react'
import { setLlmSelectionAction } from './llmSelectionActions'

interface LlmModel {
    id: string
    name: string
}

interface Props {
    conversationId: string
    currentModelId: string | null
    availableModels: LlmModel[]
}

export function LlmModelPicker({ conversationId, currentModelId, availableModels }: Props) {
    const [pending, startTransition] = useTransition()

    function handleChange(modelId: string) {
        const id = modelId || null
        startTransition(() => {
            setLlmSelectionAction(conversationId, id)
        })
    }

    if (availableModels.length === 0) {
        return (
            <div className="flex min-w-32 flex-col gap-0.5">
                <span className="text-xs text-base-content/50">LLM</span>
                <a href="/settings" className="text-xs text-primary underline">
                    前往设置添加
                </a>
            </div>
        )
    }

    return (
        <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-base-content/50">LLM</span>
            <select
                className="select select-bordered select-sm w-full min-w-44 max-w-[220px]"
                value={currentModelId ?? ''}
                onChange={e => handleChange(e.target.value)}
                disabled={pending}
            >
                <option value="">未选</option>
                {availableModels.map(m => (
                    <option key={m.id} value={m.id}>
                        {m.name}
                    </option>
                ))}
            </select>
        </div>
    )
}
