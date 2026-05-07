'use client'

import type { Model } from '~/generated/prisma/client'
import { cn } from '@lib/cn'
import { llmSupportsThinking } from '@lib/llm-chat-provider-options'
import { Cpu, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { setLlmSelectionAction } from './llmSelectionActions'

export type ComposerLlmModelOption = Pick<Model, 'id' | 'name' | 'registerId' | 'config'>

interface Props {
    conversationId: string
    currentModelId: string | null
    thinkingEnabled: boolean
    models: ComposerLlmModelOption[]
}

export function ComposerLlmSlot({ conversationId, currentModelId, thinkingEnabled, models }: Props) {
    const router = useRouter()
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [draftModelId, setDraftModelId] = useState(currentModelId ?? '')
    const [draftThinking, setDraftThinking] = useState(thinkingEnabled)
    const [pending, startTransition] = useTransition()

    const selected = models.find(m => m.id === currentModelId)
    const thinkingAllowed = selected ? llmSupportsThinking(selected) : false

    function openDialog() {
        setDraftModelId(currentModelId ?? '')
        setDraftThinking(thinkingEnabled)
        dialogRef.current?.showModal()
    }

    const draftSelected = models.find(m => m.id === draftModelId)
    const draftThinkingAllowed = draftSelected ? llmSupportsThinking(draftSelected) : false

    function save() {
        startTransition(() => {
            const modelId = draftModelId || null
            void setLlmSelectionAction(
                conversationId,
                modelId,
                modelId
                    ? { thinkingEnabled: draftThinkingAllowed && draftThinking }
                    : null,
            ).then(() => {
                dialogRef.current?.close()
                router.refresh()
            })
        })
    }

    function summaryText() {
        if (!currentModelId)
            return '未选择 LLM'
        return selected?.name ?? currentModelId
    }

    const subSummary = thinkingAllowed && thinkingEnabled ? '思考开启' : null

    if (models.length === 0) {
        return (
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-base-content/50">LLM</span>
                <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-primary underline">
                    <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
                    前往设置添加
                </Link>
            </div>
        )
    }

    return (
        <>
            <button
                type="button"
                onClick={openDialog}
                disabled={pending}
                className={cn(
                    'flex min-w-[9rem] max-w-[200px] flex-col items-start gap-0.5 rounded-btn border border-base-300 bg-base-100 px-2.5 py-1.5 text-left transition-colors',
                    'hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                )}
            >
                <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-base-content/45">
                    <Cpu className="size-3 shrink-0" aria-hidden />
                    LLM
                </span>
                <span className="w-full truncate text-sm font-medium text-base-content">{summaryText()}</span>
                {subSummary && (
                    <span className="text-[10px] text-primary">{subSummary}</span>
                )}
            </button>

            <dialog ref={dialogRef} className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-lg text-base-content">LLM 与选项</h3>
                    <div className="mt-3 grid gap-3">
                        <label className="grid gap-1">
                            <span className="text-xs font-medium text-base-content/70">模型</span>
                            <select
                                className="select select-bordered select-sm w-full"
                                value={draftModelId}
                                onChange={(e) => {
                                    const v = e.target.value
                                    setDraftModelId(v)
                                    const m = models.find(x => x.id === v)
                                    if (!m || !llmSupportsThinking(m))
                                        setDraftThinking(false)
                                }}
                                disabled={pending}
                            >
                                <option value="">未选</option>
                                {models.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </label>
                        {draftThinkingAllowed && (
                            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/60 px-3 py-2">
                                <span className="text-sm text-base-content">思考模式</span>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-primary toggle-sm"
                                    checked={draftThinking}
                                    onChange={e => setDraftThinking(e.target.checked)}
                                    disabled={pending}
                                />
                            </label>
                        )}
                    </div>
                    <div className="modal-action">
                        <button type="button" className="btn" onClick={() => dialogRef.current?.close()} disabled={pending}>取消</button>
                        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>保存</button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </>
    )
}
