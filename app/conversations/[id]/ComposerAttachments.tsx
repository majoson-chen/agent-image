'use client'

/**
 * Composer 独立图片附件区：上传落库后展示 chip，与主/次生图模型槽分离。
 */

import { USER_ATTACH_MAX_IMAGES } from '@lib/image-upload-limits'
import { ImagePlus, X } from 'lucide-react'
import { useId, useRef } from 'react'

export interface ComposerAttachmentItem {
    id: string
    mimeType: string
}

interface Props {
    conversationId: string
    items: ComposerAttachmentItem[]
    onChange: (items: ComposerAttachmentItem[]) => void
    disabled?: boolean
}

export function ComposerAttachments({
    conversationId,
    items,
    onChange,
    disabled = false,
}: Props) {
    const inputId = useId()
    const fileRef = useRef<HTMLInputElement>(null)

    async function onPickFiles(fileList: FileList | null) {
        if (!fileList?.length || disabled)
            return

        const remaining = USER_ATTACH_MAX_IMAGES - items.length
        if (remaining <= 0) {
            window.alert(`最多附加 ${USER_ATTACH_MAX_IMAGES} 张图片`)
            return
        }

        const toUpload = [...fileList].slice(0, remaining)
        const next = [...items]

        for (const file of toUpload) {
            const form = new FormData()
            form.set('conversationId', conversationId)
            form.set('file', file)

            try {
                const res = await fetch('/api/images', { method: 'POST', body: form })
                const payload = await res.json().catch(() => ({})) as { error?: string, id?: string, mimeType?: string }

                if (!res.ok) {
                    window.alert(typeof payload.error === 'string' ? payload.error : `上传失败（${res.status}）`)
                    break
                }

                if (typeof payload.id === 'string' && typeof payload.mimeType === 'string')
                    next.push({ id: payload.id, mimeType: payload.mimeType })
            }
            catch {
                window.alert('上传失败，请检查网络')
                break
            }
        }

        onChange(next)
        if (fileRef.current)
            fileRef.current.value = ''
    }

    return (
        <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
                id={inputId}
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                multiple
                className="hidden"
                disabled={disabled}
                onChange={e => void onPickFiles(e.target.files)}
            />
            <button
                type="button"
                className="btn btn-ghost btn-xs gap-1 border border-base-300"
                disabled={disabled || items.length >= USER_ATTACH_MAX_IMAGES}
                onClick={() => fileRef.current?.click()}
            >
                <ImagePlus className="size-3.5" strokeWidth={2} aria-hidden />
                附加图片
            </button>
            {items.map((item, idx) => (
                <div
                    key={item.id}
                    className="badge badge-lg gap-1 border border-base-300 bg-base-200 text-base-content"
                >
                    <span className="max-w-[8rem] truncate text-xs">
                        图
                        {idx + 1}
                    </span>
                    <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square p-0 min-h-0 h-5 w-5"
                        disabled={disabled}
                        aria-label="移除附件"
                        onClick={() => onChange(items.filter((_, i) => i !== idx))}
                    >
                        <X className="size-3" strokeWidth={2.5} aria-hidden />
                    </button>
                </div>
            ))}
        </div>
    )
}
