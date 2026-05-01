'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function NewConversationButton() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleClick() {
        setLoading(true)
        try {
            const res = await fetch('/api/conversations', { method: 'POST' })
            const conv = await res.json() as { id?: string }
            if (!res.ok || typeof conv.id !== 'string') {
                window.alert(typeof (conv as { error?: string }).error === 'string' ? (conv as { error: string }).error : '创建对话失败')
                return
            }
            router.push(`/conversations/${conv.id}`)
            router.refresh()
        }
        finally {
            setLoading(false)
        }
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="btn btn-ghost btn-xs"
            aria-label="新建对话"
        >
            {loading ? <span className="loading loading-spinner loading-xs" /> : <Plus className="size-4" strokeWidth={2} aria-hidden />}
        </button>
    )
}
