'use client'

import type { SeedreamPresetKey } from '@lib/image/seedream-presets'
import { cn } from '@lib/cn'
import { getSeedreamPreset, SEEDREAM_PRESETS } from '@lib/image/seedream-presets'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface FormState {
    preset: SeedreamPresetKey
    name: string
    baseURL: string
    apiKey: string
    supportedSizesInput: string
    supportedSizes: string[]
    maxReferenceImages: number
    supportsSeed: boolean
}

const initialState: FormState = {
    preset: 'custom',
    name: '',
    baseURL: '',
    apiKey: '',
    supportedSizesInput: '',
    supportedSizes: [],
    maxReferenceImages: 0,
    supportsSeed: false,
}

export function AddImageModelForm() {
    const router = useRouter()
    const [form, setForm] = useState<FormState>(initialState)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    function set<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    function applyPreset(p: SeedreamPresetKey) {
        set('preset', p)
        if (p === 'custom') {
            return
        }
        const def = getSeedreamPreset(p)
        setForm(prev => ({
            ...prev,
            preset: p,
            name: def.modelId,
            supportedSizes: [...def.capabilities.supportedSizes],
            maxReferenceImages: def.capabilities.maxReferenceImages,
            supportsSeed: def.capabilities.supportsSeed,
            supportedSizesInput: '',
        }))
    }

    function addSize() {
        const val = form.supportedSizesInput.trim()
        if (!val) {
            return
        }
        if (!/^\d+x\d+$/.test(val)) {
            setError('分辨率格式应为 WxH，如 1024x1024')
            return
        }
        if (form.supportedSizes.includes(val)) {
            return
        }
        set('supportedSizes', [...form.supportedSizes, val])
        set('supportedSizesInput', '')
        setError(null)
    }

    function removeSize(s: string) {
        set('supportedSizes', form.supportedSizes.filter(x => x !== s))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (form.supportedSizes.length === 0) {
            setError('至少填写一项分辨率')
            return
        }

        setLoading(true)

        const body: Record<string, unknown> = {
            type: 'IMAGE',
            providerType: 'VOLCENGINE_SEEDREAM',
            name: form.name.trim(),
            apiKey: form.apiKey.trim(),
            capabilities: {
                supportedSizes: form.supportedSizes,
                maxReferenceImages: form.maxReferenceImages,
                supportsSeed: form.supportsSeed,
            },
        }
        const bu = form.baseURL.trim()
        if (bu) {
            body.baseURL = bu
        }

        const res = await fetch('/api/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        setLoading(false)

        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            const msgs = (data.errors as Array<{ message: string }> | undefined)
                ?.map(e => e.message)
                .join('；')
            setError(msgs ?? data.error ?? '创建失败')
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
                + 添加 Seedream 生图模型
            </button>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-box border border-base-300 bg-base-100 p-4">
            <p className="mb-3 font-medium text-base-content">添加 Seedream 生图模型</p>

            {error && <div className="alert alert-error mb-3 py-2 text-sm">{error}</div>}

            <div className="grid gap-3">
                <fieldset className="fieldset">
                    <legend className="fieldset-legend">版本预设</legend>
                    <select
                        className="select select-bordered w-full"
                        value={form.preset}
                        onChange={e => applyPreset(e.target.value as SeedreamPresetKey)}
                    >
                        <option value="custom">自定义（手填模型 ID 与能力）</option>
                        {SEEDREAM_PRESETS.map(p => (
                            <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                    </select>
                    <p className="fieldset-label mt-1 text-xs text-base-content/50">
                        选好预设会自动填充下方字段；仍可按需微调。模型 ID 以方舟控制台为准。
                    </p>
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">模型 ID</legend>
                    <input
                        className="input input-bordered w-full font-mono text-sm"
                        placeholder="如 doubao-seedream-4-5-251128"
                        value={form.name}
                        onChange={e => set('name', e.target.value)}
                        required
                    />
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">API Base URL（可选）</legend>
                    <input
                        className="input input-bordered w-full font-mono text-sm"
                        placeholder="留空使用默认 LAS 网关；自定义方舟 v3 等路径时填写完整 URL"
                        value={form.baseURL}
                        onChange={e => set('baseURL', e.target.value)}
                    />
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">火山方舟 API Key</legend>
                    <input
                        type="password"
                        className="input input-bordered w-full font-mono text-sm"
                        placeholder="API Key"
                        value={form.apiKey}
                        onChange={e => set('apiKey', e.target.value)}
                        required
                    />
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">支持的分辨率（至少一项）</legend>
                    <div className="flex gap-2">
                        <input
                            className="input input-bordered flex-1 font-mono text-sm"
                            placeholder="如 2048x2048"
                            value={form.supportedSizesInput}
                            onChange={e => set('supportedSizesInput', e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    addSize()
                                }
                            }}
                        />
                        <button type="button" className="btn btn-outline btn-sm" onClick={addSize}>
                            添加
                        </button>
                    </div>
                    {form.supportedSizes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {form.supportedSizes.map(s => (
                                <span key={s} className="badge badge-outline gap-1">
                                    {s}
                                    <button type="button" className="ml-1 text-xs opacity-60 hover:opacity-100" onClick={() => removeSize(s)}>✕</button>
                                </span>
                            ))}
                        </div>
                    )}
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">最大参考图张数</legend>
                    <input
                        type="number"
                        className="input input-bordered w-full"
                        min={0}
                        max={14}
                        value={form.maxReferenceImages}
                        onChange={e => set('maxReferenceImages', Number(e.target.value))}
                    />
                    <p className="fieldset-label text-xs text-base-content/50">
                        Seedream 4.5 / 5.0 lite 最多支持 14 张；设 0 表示不支持参考图
                    </p>
                </fieldset>

                <fieldset className="fieldset">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={form.supportsSeed}
                            onChange={e => set('supportsSeed', e.target.checked)}
                        />
                        <span className="text-sm">支持 seed 参数</span>
                        <span className="text-xs text-base-content/50">（仅 doubao-seedream-3.0-t2i）</span>
                    </label>
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
