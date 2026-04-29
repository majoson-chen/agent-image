'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SearchModelActions({ id }: { id: string }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleDelete() {
        if (!confirm('确定删除该 Search 模型？绑定到此模型的工具将失效。'))
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
            {loading ? <span className="loading loading-spinner loading-xs" /> : <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />}
        </button>
    )
}
