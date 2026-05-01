'use client'

import type { ImageModelCapabilities } from '@lib/validation/image-model-schema'
import { cn } from '@lib/cn'
import { ExternalLink, Images } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { setImageSelectionAction } from './imageSelectionActions'

export interface ComposerImageModelOption {
    id: string
    name: string
    capabilities: ImageModelCapabilities | null
}

interface Props {
    conversationId: string
    role: 'IMAGE_PRIMARY' | 'IMAGE_SECONDARY'
    currentModelId: string | null
    currentSize: string | null
    models: ComposerImageModelOption[]
}

const ROLE_LABEL: Record<Props['role'], string> = {
    IMAGE_PRIMARY: '主生图',
    IMAGE_SECONDARY: '次生图',
}

function imageDraftFromProps(
    models: ComposerImageModelOption[],
    currentModelId: string | null,
    currentSize: string | null,
): { modelId: string, size: string } {
    const mId = currentModelId ?? ''
    const sel = models.find(m => m.id === mId)
    const sz = sel?.capabilities?.supportedSizes ?? []
    const size
        = currentSize && sz.includes(currentSize)
            ? currentSize
            : (sz[0] ?? '')
    return { modelId: mId, size }
}

export function ComposerImageSlot({
    conversationId,
    role,
    currentModelId,
    currentSize,
    models,
}: Props) {
    const router = useRouter()
    const dialogRef = useRef<HTMLDialogElement>(null)
    const label = ROLE_LABEL[role]
    const [draftModelId, setDraftModelId] = useState(currentModelId ?? '')
    const [draftSize, setDraftSize] = useState('')
    const [pending, startTransition] = useTransition()

    function openDialog() {
        const { modelId, size } = imageDraftFromProps(models, currentModelId, currentSize)
        setDraftModelId(modelId)
        setDraftSize(size)
        dialogRef.current?.showModal()
    }

    function save() {
        const modelId = draftModelId || null
        const size = modelId && draftSize ? draftSize : null
        startTransition(() => {
            void setImageSelectionAction(conversationId, role, modelId, size).then(() => {
                dialogRef.current?.close()
                router.refresh()
            })
        })
    }

    const curName = models.find(m => m.id === currentModelId)?.name

    function summaryLine2() {
        if (!currentModelId)
            return '未选择'
        if (currentSize)
            return `${curName ?? '已选'} · ${currentSize}`
        return curName ?? '已选'
    }

    if (models.length === 0) {
        return (
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-base-content/50">{label}</span>
                <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-primary underline">
                    <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
                    前往设置添加
                </Link>
            </div>
        )
    }

    const draftForSizes = models.find(m => m.id === draftModelId)
    const draftSizes = draftForSizes?.capabilities?.supportedSizes ?? []

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
                    <Images className="size-3 shrink-0" aria-hidden />
                    {label}
                </span>
                <span className="w-full truncate text-sm font-medium text-base-content">{summaryLine2()}</span>
            </button>

            <dialog ref={dialogRef} className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-lg text-base-content">
                        {label}
                        设置
                    </h3>
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
                                    const sz = m?.capabilities?.supportedSizes ?? []
                                    setDraftSize(sz[0] ?? '')
                                }}
                                disabled={pending}
                            >
                                <option value="">未选</option>
                                {models.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </label>
                        {draftModelId && draftSizes.length > 0 && (
                            <label className="grid gap-1">
                                <span className="text-xs font-medium text-base-content/70">尺寸</span>
                                <select
                                    className="select select-bordered select-sm w-full"
                                    value={draftSize}
                                    onChange={e => setDraftSize(e.target.value)}
                                    disabled={pending}
                                >
                                    {draftSizes.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
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
