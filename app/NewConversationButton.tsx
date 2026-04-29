'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function NewConversationButton() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleClick() {
        setLoading(true)
        const res = await fetch('/api/conversations', { method: 'POST' })
        const conv = await res.json() as { id: string }
        router.push(`/conversations/${conv.id}`)
        router.refresh()
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="btn btn-ghost btn-xs"
            aria-label="新建对话"
        >
            {loading ? <span className="loading loading-spinner loading-xs" /> : '+'}
        </button>
    )
}
