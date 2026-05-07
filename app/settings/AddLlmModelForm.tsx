'use client'

import { cn } from '@lib/cn'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface LlmRegisterOption {
    registerId: string
    title: string
}

type LlmRegisterId = 'openai/official' | 'openai-compatible/generic' | 'alibaba/dashscope-llm'

function llmApiModelPlaceholder(registerId: LlmRegisterId): string {
    if (registerId === 'alibaba/dashscope-llm')
        return '如 qwen-plus'
    if (registerId === 'openai-compatible/generic')
        return '如 moonshot-v1-8k'
    return '如 gpt-4o'
}

interface FormState {
    /** 列表与侧栏展示用 */
    displayName: string
    registerId: LlmRegisterId
    /** 实际请求 LLM 时的 modelId */
    modelId: string
    baseURL: string
    apiKey: string
    /** 阿里云百炼专用：勾选后写入 capabilities.supportsThinking */
    supportsThinking: boolean
}

const initialState: FormState = {
    displayName: '',
    registerId: 'openai/official',
    modelId: '',
    baseURL: '',
    apiKey: '',
    supportsThinking: false,
}

export function AddLlmModelForm() {
    const router = useRouter()
    const [form, setForm] = useState<FormState>(initialState)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [registryOptions, setRegistryOptions] = useState<LlmRegisterOption[] | null>(null)

    useEffect(() => {
        if (!open || registryOptions)
            return
        void (async () => {
            const res = await fetch('/api/register-metadata?type=LLM')
            if (!res.ok) {
                setRegistryOptions([])
                return
            }
            const rows = await res.json() as Array<{ registerId: string, title: string }>
            setRegistryOptions(rows.map(r => ({ registerId: r.registerId, title: r.title })))
        })()
    }, [open, registryOptions])

    function set(key: keyof FormState, value: string) {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const payload: Record<string, unknown> = {
            type: 'LLM',
            name: form.displayName.trim(),
            registerId: form.registerId,
            config: {
                modelId: form.modelId.trim(),
                apiKey: form.apiKey.trim(),
            },
        }
        const config = payload.config as Record<string, unknown>
        if (form.registerId === 'openai-compatible/generic') {
            config.baseURL = form.baseURL.trim()
        }
        else if (form.registerId === 'alibaba/dashscope-llm') {
            const b = form.baseURL.trim()
            if (b) {
                config.baseURL = b
            }
            if (form.supportsThinking) {
                config.capabilities = { supportsThinking: true }
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
                className="btn btn-outline btn-sm gap-1.5"
                onClick={() => setOpen(true)}
            >
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                添加 LLM 模型
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
                    <legend className="fieldset-legend">显示名称</legend>
                    <input
                        className="input input-bordered w-full"
                        placeholder="设置列表中的名称（如「我的 GPT-4o」）"
                        value={form.displayName}
                        onChange={e => set('displayName', e.target.value)}
                        required
                    />
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">Register</legend>
                    <select
                        className="select select-bordered w-full"
                        value={form.registerId}
                        onChange={(e) => {
                            const v = e.target.value as LlmRegisterId
                            setForm(prev => ({ ...prev, registerId: v }))
                        }}
                    >
                        {registryOptions?.length
                            ? registryOptions.map(o => (
                                    <option key={o.registerId} value={o.registerId}>{o.title}</option>
                                ))
                            : (
                                    <>
                                        <option value="openai/official">OpenAI 官方</option>
                                        <option value="openai-compatible/generic">OpenAI 兼容（通用）</option>
                                        <option value="alibaba/dashscope-llm">阿里云百炼（DashScope）</option>
                                    </>
                                )}
                    </select>
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">API 模型 ID</legend>
                    <input
                        className="input input-bordered w-full font-mono text-sm"
                        placeholder={llmApiModelPlaceholder(form.registerId)}
                        value={form.modelId}
                        onChange={e => set('modelId', e.target.value)}
                        required
                    />
                </fieldset>

                {(form.registerId === 'openai-compatible/generic' || form.registerId === 'alibaba/dashscope-llm') && (
                    <fieldset className="fieldset">
                        <legend className="fieldset-legend">
                            {form.registerId === 'alibaba/dashscope-llm' ? 'Base URL（可选）' : 'Base URL'}
                        </legend>
                        <input
                            className="input input-bordered w-full font-mono text-sm"
                            placeholder={
                                form.registerId === 'alibaba/dashscope-llm'
                                    ? '留空使用 SDK 默认（国际兼容端点）'
                                    : 'https://api.example.com/v1'
                            }
                            value={form.baseURL}
                            onChange={e => set('baseURL', e.target.value)}
                            required={form.registerId === 'openai-compatible/generic'}
                        />
                        {form.registerId === 'alibaba/dashscope-llm' && (
                            <p className="mt-1 text-xs text-base-content/60">
                                中国内地可填 https://dashscope.aliyuncs.com/compatible-mode/v1
                            </p>
                        )}
                    </fieldset>
                )}

                {form.registerId === 'alibaba/dashscope-llm' && (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2">
                        <span className="text-sm text-base-content">模型支持思考模式</span>
                        <input
                            type="checkbox"
                            className="toggle toggle-primary toggle-sm"
                            checked={form.supportsThinking}
                            onChange={e => setForm(prev => ({ ...prev, supportsThinking: e.target.checked }))}
                        />
                    </label>
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
                        setRegistryOptions(null)
                    }}
                >
                    取消
                </button>
            </div>
        </form>
    )
}
