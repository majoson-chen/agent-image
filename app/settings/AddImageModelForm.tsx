'use client'

import type { SeedreamPresetKey } from '@lib/image/seedream-presets'
import type { WanImagePresetKey } from '@lib/image/wan-image-presets'
import { cn } from '@lib/cn'
import { getSeedreamPreset, SEEDREAM_PRESETS } from '@lib/image/seedream-presets'
import { getWanImagePreset, WAN_IMAGE_PRESETS } from '@lib/image/wan-image-presets'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ImageVendor = 'seedream' | 'wan'

interface FormState {
    vendor: ImageVendor
    seedreamPreset: SeedreamPresetKey
    wanPreset: WanImagePresetKey
    name: string
    baseURL: string
    apiKey: string
    supportedSizesInput: string
    supportedSizes: string[]
    maxReferenceImages: number
    supportsSeed: boolean
}

const emptyCaps = {
    name: '',
    baseURL: '',
    apiKey: '',
    supportedSizesInput: '',
    supportedSizes: [] as string[],
    maxReferenceImages: 0,
    supportsSeed: false,
}

const initialState: FormState = {
    vendor: 'seedream',
    seedreamPreset: 'custom',
    wanPreset: 'custom',
    ...emptyCaps,
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

    function applySeedreamPreset(p: SeedreamPresetKey) {
        set('seedreamPreset', p)
        if (p === 'custom') {
            setForm(prev => ({ ...prev, seedreamPreset: 'custom', ...emptyCaps }))
            return
        }
        const def = getSeedreamPreset(p)
        setForm(prev => ({
            ...prev,
            seedreamPreset: p,
            name: def.modelId,
            supportedSizes: [...def.capabilities.supportedSizes],
            maxReferenceImages: def.capabilities.maxReferenceImages,
            supportsSeed: def.capabilities.supportsSeed,
            supportedSizesInput: '',
        }))
    }

    function applyWanPreset(p: WanImagePresetKey) {
        set('wanPreset', p)
        if (p === 'custom') {
            setForm(prev => ({ ...prev, wanPreset: 'custom', ...emptyCaps }))
            return
        }
        const def = getWanImagePreset(p)
        setForm(prev => ({
            ...prev,
            wanPreset: p,
            name: def.modelId,
            supportedSizes: [...def.capabilities.supportedSizes],
            maxReferenceImages: def.capabilities.maxReferenceImages,
            supportsSeed: def.capabilities.supportsSeed,
            supportedSizesInput: '',
        }))
    }

    function setVendor(vendor: ImageVendor) {
        if (vendor === form.vendor)
            return
        setForm({
            ...initialState,
            vendor,
        })
    }

    function presetValue(): string {
        return form.vendor === 'seedream' ? form.seedreamPreset : form.wanPreset
    }

    function onPresetChange(raw: string) {
        if (form.vendor === 'seedream')
            applySeedreamPreset(raw as SeedreamPresetKey)
        else applyWanPreset(raw as WanImagePresetKey)
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

        const providerType = form.vendor === 'seedream' ? 'VOLCENGINE_SEEDREAM' : 'DASHSCOPE_WAN_IMAGE'
        const body: Record<string, unknown> = {
            type: 'IMAGE',
            providerType,
            name: form.name.trim(),
            apiKey: form.apiKey.trim(),
            capabilities: {
                supportedSizes: form.supportedSizes,
                maxReferenceImages: form.maxReferenceImages,
                supportsSeed: form.supportsSeed,
            },
        }
        const bu = form.baseURL.trim()
        if (bu)
            body.baseURL = bu

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

    const maxRefs = form.vendor === 'wan' ? 9 : 14

    if (!open) {
        return (
            <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setOpen(true)}
            >
                + 添加生图模型
            </button>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-box border border-base-300 bg-base-100 p-4">
            <p className="mb-3 font-medium text-base-content">添加生图模型</p>

            {error && <div className="alert alert-error mb-3 py-2 text-sm">{error}</div>}

            <div className="grid gap-3">
                <fieldset className="fieldset">
                    <legend className="fieldset-legend">服务商</legend>
                    <select
                        className="select select-bordered w-full"
                        value={form.vendor}
                        onChange={e => setVendor(e.target.value as ImageVendor)}
                    >
                        <option value="seedream">火山引擎 · 方舟 Seedream</option>
                        <option value="wan">阿里云 · 百炼万相图像（DashScope）</option>
                    </select>
                    <p className="fieldset-label mt-1 text-xs text-base-content/50">
                        各服务商的 API Key 与网关须分别配置，并与控制台所选地域一致。此处仅文生图 / 图生图（图像），不含视频。
                    </p>
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">版本预设</legend>
                    <select
                        className="select select-bordered w-full"
                        value={presetValue()}
                        onChange={e => onPresetChange(e.target.value)}
                    >
                        <option value="custom">自定义（手动填写模型 ID 与能力）</option>
                        {form.vendor === 'seedream'
                            ? SEEDREAM_PRESETS.map(p => (
                                    <option key={p.key} value={p.key}>{p.label}</option>
                                ))
                            : WAN_IMAGE_PRESETS.map(p => (
                                    <option key={p.key} value={p.key}>{p.label}</option>
                                ))}
                    </select>
                    <p className="fieldset-label mt-1 text-xs text-base-content/50">
                        {form.vendor === 'seedream'
                            ? '预设对应常见方舟模型 ID，仍以火山控制台为准，可再微调。'
                            : '预设对应万相 2.7 图像模型 ID，仍以百炼控制台为准，可再微调。'}
                    </p>
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">模型 ID</legend>
                    <input
                        className="input input-bordered w-full font-mono text-sm"
                        placeholder={
                            form.vendor === 'seedream'
                                ? '例如 doubao-seedream-4-5-251128'
                                : '例如 wan2.7-image-pro'
                        }
                        value={form.name}
                        onChange={e => set('name', e.target.value)}
                        required
                    />
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">API Base URL（可选）</legend>
                    <input
                        className="input input-bordered w-full font-mono text-sm"
                        placeholder={
                            form.vendor === 'seedream'
                                ? '留空使用内置默认 LAS 地址；自管接入点时填完整 https URL'
                                : '留空使用北京「多模态图像生成」默认地址；国际站等请填控制台完整 endpoint'
                        }
                        value={form.baseURL}
                        onChange={e => set('baseURL', e.target.value)}
                    />
                    {form.vendor === 'wan' && (
                        <p className="fieldset-label mt-1 text-xs text-base-content/50">
                            地域与 Key 必须同属北京或同属新加坡等国际区，勿混用。
                        </p>
                    )}
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">
                        {form.vendor === 'seedream' ? '方舟 API Key' : '百炼 API Key（DashScope）'}
                    </legend>
                    <input
                        type="password"
                        className="input input-bordered w-full font-mono text-sm"
                        placeholder={form.vendor === 'seedream' ? 'ARK API Key' : 'DASHSCOPE_API_KEY'}
                        value={form.apiKey}
                        onChange={e => set('apiKey', e.target.value)}
                        required
                    />
                </fieldset>

                <fieldset className="fieldset">
                    <legend className="fieldset-legend">可选分辨率（至少一项）</legend>
                    <div className="flex gap-2">
                        <input
                            className="input input-bordered flex-1 font-mono text-sm"
                            placeholder="例如 2048x2048"
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
                    <p className="fieldset-label mt-1 text-xs text-base-content/50">
                        格式为宽×高（如 1024x1024）；对话中仅能选择此处已添加的规格。
                        {form.vendor === 'wan'
                            ? ' 选用万相时，服务端会将常见正方形对齐为百炼文档中的 1K / 2K / 4K 等档位。'
                            : ''}
                    </p>
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
                        max={maxRefs}
                        value={form.maxReferenceImages}
                        onChange={(e) => {
                            const n = Number(e.target.value)
                            const clamped = Number.isFinite(n)
                                ? Math.min(Math.max(0, n), maxRefs)
                                : 0
                            set('maxReferenceImages', clamped)
                        }}
                    />
                    <p className="fieldset-label text-xs text-base-content/50">
                        {form.vendor === 'seedream'
                            ? 'Seedream 常见型号最多约 14 张参考图；填 0 表示不向模型传参考图'
                            : '万相图像接口单轮最多 9 张参考图；填 0 表示仅文生图、不使用参考图'}
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
                        <span className="text-sm">模型支持 seed（当前对话工具未暴露 seed，此项仅作能力标注）</span>
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
