'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '../../lib/cn'

type ProviderType = 'OPENAI' | 'OPENAI_COMPATIBLE' | 'ALIBABA'

function llmModelNamePlaceholder(p: ProviderType): string {
    if (p === 'ALIBABA')
        return '如 qwen-plus'
    if (p === 'OPENAI_COMPATIBLE')
        return '如 moonshot-v1-8k'
    return '如 gpt-4o'
}

interface FormState {
    name: string
    providerType: ProviderType
    baseURL: string
    apiKey: string
    contextWindow: string
}

const initialState: FormState = {
    name: '',
    providerType: 'OPENAI',
    baseURL: '',
    apiKey: '',
    contextWindow: '128000',
}

export function AddLlmModelForm() {
    const router = useRouter()
    const [form, setForm] = useState<FormState>(initialState)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    function set(key: keyof FormState, value: string) {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const payload: Record<string, unknown> = {
            name: form.name.trim(),
            providerType: form.providerType,
            apiKey: form.apiKey.trim(),
            contextWindow: Number(form.contextWindow),
        }
        if (form.providerType === 'OPENAI_COMPATIBLE') {
            payload.baseURL = form.baseURL.trim()
        }
        else if (form.providerType === 'ALIBABA') {
            const b = form.baseURL.trim()
            if (b) {
                payload.baseURL = b
            }
        }

        const res = await fetch('/api/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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
        router.refresh()
    }

    if (!open) {
        return (
            <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setOpen(true)}
            >
                + 添加 LLM 模型
            </button>
        )
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-box border border-base-300 bg-base-100 p-4"
        >
            <p className="mb-3 font-medium text-base-content">添加 LLM 模型</p>

            {error && (
                <div className="alert alert-error mb-3 py-2 text-sm">{error}</div>
            )}

            <div className="grid gap-3">
                <fieldset className="fieldset">
                    <legend className="fieldset-legend">模型名称</legend>
                    <input
                        className="input input-bordered w-full"
                        placeholder={llmModelNamePlaceholder(form.providerType)}
                        value={form.name}
                        onChange={e => set('name', e.target.value)}
                        required
                    />
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">Provider 类型</legend>
                    <select
                        className="select select-bordered w-full"
                        value={form.providerType}
                        onChange={e => set('providerType', e.target.value as ProviderType)}
                    >
                        <option value="OPENAI">OpenAI</option>
                        <option value="OPENAI_COMPATIBLE">OpenAI Compatible</option>
                        <option value="ALIBABA">阿里云百炼（DashScope）</option>
                    </select>
                </fieldset>

                {(form.providerType === 'OPENAI_COMPATIBLE' || form.providerType === 'ALIBABA') && (
                    <fieldset className="fieldset">
                        <legend className="fieldset-legend">
                            {form.providerType === 'ALIBABA' ? 'Base URL（可选）' : 'Base URL'}
                        </legend>
                        <input
                            className="input input-bordered w-full font-mono text-sm"
                            placeholder={
                                form.providerType === 'ALIBABA'
                                    ? '留空使用 SDK 默认（国际兼容端点）'
                                    : 'https://api.example.com/v1'
                            }
                            value={form.baseURL}
                            onChange={e => set('baseURL', e.target.value)}
                            required={form.providerType === 'OPENAI_COMPATIBLE'}
                        />
                        {form.providerType === 'ALIBABA' && (
                            <p className="mt-1 text-xs text-base-content/60">
                                中国内地可填 https://dashscope.aliyuncs.com/compatible-mode/v1
                            </p>
                        )}
                    </fieldset>
                )}

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">API Key</legend>
                    <input
                        type="password"
                        className="input input-bordered w-full font-mono text-sm"
                        placeholder="sk-..."
                        value={form.apiKey}
                        onChange={e => set('apiKey', e.target.value)}
                        required
                    />
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">Context Window（tokens）</legend>
                    <input
                        type="number"
                        className="input input-bordered w-full"
                        placeholder="128000"
                        min={1}
                        value={form.contextWindow}
                        onChange={e => set('contextWindow', e.target.value)}
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
                    }}
                >
                    取消
                </button>
            </div>
        </form>
    )
}
