/**
 * Settings：添加 LLM 模型 — Register 选择与按 Register 懒加载子表单。
 */
'use client'

import type { LlmRegisterFormProps } from '@lib/settings/llm-register-form-loaders'
import { loadLlmRegisterFormModule } from '@lib/settings/llm-register-form-loaders'
import { Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'

interface LlmRegisterOption {
    registerId: string
    title: string
}

/** API 不可用时的备选（与先前硬编码下拉一致）。 */
function fallbackLlmRegisterOptions(): LlmRegisterOption[] {
    return [
        { registerId: 'openai/official', title: 'OpenAI 官方' },
        { registerId: 'openai-compatible/generic', title: 'OpenAI 兼容（通用）' },
        {
            registerId: 'alibaba/dashscope-kimi-k2-6',
            title: 'Kimi K2.6 · DashScope SKU',
        },
        {
            registerId: 'alibaba/dashscope-qwen3-6-plus',
            title: 'Qwen 3.6 Plus · DashScope SKU',
        },
        { registerId: 'alibaba/dashscope-llm', title: '阿里云 DashScope（自填模型）' },
    ]
}

function LlmRegisterDynamicForm({
    registerId,
    ...formProps
}: { registerId: string } & LlmRegisterFormProps) {
    const Form = useMemo(
        () =>
            dynamic(
                () => loadLlmRegisterFormModule(registerId).then(m => m.default),
                { ssr: false },
            ),
        [registerId],
    )
    return <Form key={registerId} {...formProps} />
}

export function AddLlmModelForm() {
    const [open, setOpen] = useState(false)
    const [registryOptions, setRegistryOptions] = useState<LlmRegisterOption[] | null>(null)
    const [registerId, setRegisterId] = useState('openai/official')

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

    const options
        = registryOptions === null || registryOptions.length === 0
            ? fallbackLlmRegisterOptions()
            : registryOptions

    function handleDismiss() {
        setOpen(false)
        setRegisterId('openai/official')
        setRegistryOptions(null)
    }

    function handleCreated() {
        setOpen(false)
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
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <p className="mb-3 font-medium text-base-content">添加 LLM 模型</p>

            <div className="mb-4 grid gap-3">
                <fieldset className="fieldset">
                    <legend className="fieldset-legend">Register</legend>
                    <select
                        className="select select-bordered w-full"
                        value={registerId}
                        onChange={(e) => {
                            setRegisterId(e.target.value)
                        }}
                    >
                        {options.map(o => (
                            <option key={o.registerId} value={o.registerId}>{o.title}</option>
                        ))}
                    </select>
                </fieldset>
            </div>

            <LlmRegisterDynamicForm
                registerId={registerId}
                onCancel={handleDismiss}
                onCreated={handleCreated}
            />
        </div>
    )
}
