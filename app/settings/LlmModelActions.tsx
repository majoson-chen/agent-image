'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LlmModelActions({ id }: { id: string }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleDelete() {
        if (!confirm('确定删除该模型？'))
            return
        setLoading(true)
        await fetch(`/api/models/${id}`, { method: 'DELETE' })
        router.refresh()
    }

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="btn btn-ghost btn-xs text-error"
            aria-label="删除模型"
        >
            {loading ? <span className="loading loading-spinner loading-xs" /> : '删除'}
        </button>
    )
}
