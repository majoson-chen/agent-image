'use client'

import { PencilLine, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { cn } from '../lib/cn'

export interface SidebarConversation {
    id: string
    title: string | null
}

export function ConversationSidebarNav({ conversations }: { conversations: SidebarConversation[] }) {
    const pathname = usePathname()
    const router = useRouter()
    const renameDialogRef = useRef<HTMLDialogElement>(null)
    const deleteDialogRef = useRef<HTMLDialogElement>(null)
    const [renameTarget, setRenameTarget] = useState<SidebarConversation | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [renameError, setRenameError] = useState<string | null>(null)
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    function openRename(c: SidebarConversation) {
        setRenameError(null)
        setRenameTarget(c)
        setRenameDraft(c.title ?? '')
        renameDialogRef.current?.showModal()
    }

    async function submitRename() {
        if (!renameTarget)
            return
        setBusy(true)
        setRenameError(null)
        try {
            const res = await fetch(`/api/conversations/${renameTarget.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: renameDraft }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setRenameError(typeof data.error === 'string' ? data.error : '重命名失败')
                return
            }
            renameDialogRef.current?.close()
            setRenameTarget(null)
            router.refresh()
        }
        finally {
            setBusy(false)
        }
    }

    function openDelete(id: string) {
        setDeleteTargetId(id)
        deleteDialogRef.current?.showModal()
    }

    async function confirmDelete() {
        if (!deleteTargetId)
            return
        setBusy(true)
        try {
            const res = await fetch(`/api/conversations/${deleteTargetId}`, { method: 'DELETE' })
            if (!res.ok) {
                window.alert('删除失败')
                return
            }
            deleteDialogRef.current?.close()
            const remaining = conversations.filter(c => c.id !== deleteTargetId)
            if (pathname === `/conversations/${deleteTargetId}`) {
                if (remaining[0])
                    router.replace(`/conversations/${remaining[0].id}`)
                else
                    router.replace('/')
            }
            setDeleteTargetId(null)
            router.refresh()
        }
        finally {
            setBusy(false)
        }
    }

    return (
        <>
            {conversations.map((c) => {
                const active = pathname === `/conversations/${c.id}`
                return (
                    <div
                        key={c.id}
                        className={cn(
                            'flex items-center gap-0.5 rounded-box py-1 pl-1 pr-0.5',
                            active && 'bg-base-300',
                        )}
                    >
                        <Link
                            href={`/conversations/${c.id}`}
                            className={cn(
                                'min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-sm text-base-content',
                                !active && 'hover:bg-base-300/70',
                            )}
                        >
                            {c.title ?? '新对话'}
                        </Link>
                        <div className="flex shrink-0 items-center">
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square px-0"
                                aria-label="重命名对话"
                                onClick={() => openRename(c)}
                            >
                                <PencilLine className="size-3.5" strokeWidth={2} aria-hidden />
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square px-0 text-error"
                                aria-label="删除对话"
                                onClick={() => openDelete(c.id)}
                            >
                                <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
                            </button>
                        </div>
                    </div>
                )
            })}

            <dialog
                ref={renameDialogRef}
                className="modal"
                onClose={() => {
                    setRenameTarget(null)
                    setRenameError(null)
                }}
            >
                <div className="modal-box">
                    <h3 className="font-bold text-lg text-base-content">重命名对话</h3>
                    <input
                        className={cn('input input-bordered w-full mt-3', renameError && 'input-error')}
                        value={renameDraft}
                        onChange={e => setRenameDraft(e.target.value)}
                        disabled={busy}
                    />
                    {renameError && (
                        <p className="mt-2 text-xs text-error">{renameError}</p>
                    )}
                    <div className="modal-action">
                        <button
                            type="button"
                            className="btn"
                            onClick={() => renameDialogRef.current?.close()}
                            disabled={busy}
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={submitRename}
                            disabled={busy}
                        >
                            保存
                        </button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>

            <dialog
                ref={deleteDialogRef}
                className="modal"
                onClose={() => setDeleteTargetId(null)}
            >
                <div className="modal-box">
                    <h3 className="font-bold text-lg text-base-content">删除对话？</h3>
                    <p className="py-3 text-sm text-base-content/70">
                        将删除本会话及其中的消息与本地图像，且不可恢复。
                    </p>
                    <div className="modal-action">
                        <button
                            type="button"
                            className="btn"
                            onClick={() => deleteDialogRef.current?.close()}
                            disabled={busy}
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            className="btn btn-error"
                            onClick={confirmDelete}
                            disabled={busy}
                        >
                            删除
                        </button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </>
    )
}
