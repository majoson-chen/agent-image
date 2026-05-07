'use client'

import { cn } from '@lib/cn'
import { fallbackRegisterMetadataRows } from '@lib/providers/register-metadata-fallback'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface RegisterRow {
    registerId: string
    title: string
}

interface FormState {
    name: string
    apiKey: string
    /** 静态目录中的 registerId（当前仅 Brave） */
    registerId: string
}

const initialState: FormState = { name: '', apiKey: '', registerId: 'brave/search' }

export function AddSearchModelForm() {
    const router = useRouter()
    const [form, setForm] = useState<FormState>(initialState)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [registerRows, setRegisterRows] = useState<RegisterRow[] | null>(null)

    useEffect(() => {
        if (!open || registerRows)
            return
        void (async () => {
            const res = await fetch('/api/register-metadata?type=SEARCH')
            if (!res.ok) {
                setRegisterRows([])
                return
            }
            const rows = await res.json() as RegisterRow[]
            setRegisterRows(rows)
            setForm(prev => ({
                ...prev,
                registerId: rows[0]?.registerId ?? prev.registerId,
            }))
        })()
    }, [open, registerRows])

    function set<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const res = await fetch('/api/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'SEARCH',
                registerId: form.registerId,
                name: form.name.trim(),
                config: {
                    apiKey: form.apiKey.trim(),
                },
            }),
        })

        setLoading(false)

        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            const msgs = (data.errors as Array<{ message: string }> | undefined)
                ?.map(e => e.message)
                .join('；')
            setError(msgs ?? '创建失败')
            return
        }

        setForm(initialState)
        setOpen(false)
        setRegisterRows(null)
        router.refresh()
    }

    const searchFallback = fallbackRegisterMetadataRows('SEARCH')
    const titleLabel
        = registerRows?.find(r => r.registerId === form.registerId)?.title
            ?? searchFallback.find(r => r.registerId === form.registerId)?.title
            ?? searchFallback[0]?.title
            ?? 'Search'

    if (!open) {
        return (
            <button
                type="button"
                className="btn btn-outline btn-sm gap-1.5"
                onClick={() => setOpen(true)}
            >
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                添加 Search 模型
            </button>
        )
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-box border border-base-300 bg-base-100 p-4"
        >
            <p className="mb-3 font-medium text-base-content">{`添加 ${titleLabel}`}</p>

            {error && (
                <div className="alert alert-error mb-3 py-2 text-sm">{error}</div>
            )}

            <div className="grid gap-3">
                {registerRows && registerRows.length > 1 && (
                    <fieldset className="fieldset">
                        <legend className="fieldset-legend">Register</legend>
                        <select
                            className="select select-bordered w-full"
                            value={form.registerId}
                            onChange={e => set('registerId', e.target.value)}
                        >
                            {registerRows.map(r => (
                                <option key={r.registerId} value={r.registerId}>{r.title}</option>
                            ))}
                        </select>
                    </fieldset>
                )}

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">模型名称</legend>
                    <input
                        className="input input-bordered w-full"
                        placeholder="如 Brave Search"
                        value={form.name}
                        onChange={e => set('name', e.target.value)}
                        required
                    />
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">Brave Subscription Token</legend>
                    <input
                        type="password"
                        className="input input-bordered w-full font-mono text-sm"
                        placeholder="BSA..."
                        value={form.apiKey}
                        onChange={e => set('apiKey', e.target.value)}
                        required
                    />
                </fieldset>
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    type="submit"
                    disabled={loading}
                    className={cn('btn btn-primary btn-sm', loading && 'loading')}
                >
                    {loading ? '保存中…' : '保存'}
                </button>
                <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                        setOpen(false)
                        setError(null)
                        setForm(initialState)
                        setRegisterRows(null)
                    }}
                >
                    取消
                </button>
            </div>
        </form>
    )
}
