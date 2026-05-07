/**
 * Register `alibaba/dashscope-llm` — 新建 LLM 模型表单。
 */
'use client'

import type { LlmRegisterFormProps } from '@lib/settings/llm-register-form-loaders'
import { cn } from '@lib/cn'
import { validateThinkingBudgetOrEmpty } from '@lib/settings/llm-register-form-helpers'
import { postCreateLlmModel } from '@lib/settings/post-create-llm-model'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { DashScopeConnectionFields } from './DashScopeConnectionFields'

export default function AlibabaDashscopeLlmModelForm(props: LlmRegisterFormProps) {
    const router = useRouter()
    const [displayName, setDisplayName] = useState('')
    const [modelId, setModelId] = useState('')
    const [baseURL, setBaseURL] = useState('')
    const [thinkingBudget, setThinkingBudget] = useState('')
    const [supportsThinking, setSupportsThinking] = useState(false)
    const [apiKey, setApiKey] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        const budgetTrim = thinkingBudget.trim()
        const budgetErr = validateThinkingBudgetOrEmpty(budgetTrim)
        if (budgetErr) {
            setError(budgetErr)
            return
        }

        setLoading(true)

        const config: Record<string, unknown> = {
            apiKey: apiKey.trim(),
            modelId: modelId.trim(),
        }
        const b = baseURL.trim()
        if (b)
            config.baseURL = b

        const capabilities: Record<string, unknown> = {}
        if (budgetTrim !== '')
            capabilities.thinkingBudget = Number.parseInt(budgetTrim, 10)

        if (supportsThinking)
            capabilities.supportsThinking = true

        if (Object.keys(capabilities).length > 0)
            config.capabilities = capabilities

        const payload = {
            type: 'LLM',
            name: displayName.trim(),
            registerId: 'alibaba/dashscope-llm',
            config,
        }

        const result = await postCreateLlmModel(payload)
        setLoading(false)

        if (!result.ok) {
            setError(result.message)
            return
        }

        router.refresh()
        props.onCreated()
    }

    return (
        <form className="grid gap-3" onSubmit={handleSubmit}>
            {error && (
                <div className="alert alert-error py-2 text-sm">{error}</div>
            )}

            <fieldset className="fieldset">
                <legend className="fieldset-legend">显示名称</legend>
                <input
                    className="input input-bordered w-full"
                    placeholder="设置列表中的名称（如「团队千问」）"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                />
            </fieldset>

            <fieldset className="fieldset">
                <legend className="fieldset-legend">API 模型 ID</legend>
                <input
                    className="input input-bordered w-full font-mono text-sm"
                    placeholder="如 qwen-plus"
                    value={modelId}
                    onChange={e => setModelId(e.target.value)}
                    required
                />
            </fieldset>

            <DashScopeConnectionFields
                baseURL={baseURL}
                setBaseURL={setBaseURL}
                thinkingBudget={thinkingBudget}
                setThinkingBudget={setThinkingBudget}
            />

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2">
                <span className="text-sm text-base-content">模型支持思考模式</span>
                <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={supportsThinking}
                    onChange={e => setSupportsThinking(e.target.checked)}
                />
            </label>

            <fieldset className="fieldset">
                <legend className="fieldset-legend">API Key</legend>
                <input
                    type="password"
                    className="input input-bordered w-full font-mono text-sm"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    required
                />
            </fieldset>

            <div className="flex gap-2">
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
                    onClick={props.onCancel}
                    disabled={loading}
                >
                    取消
                </button>
            </div>
        </form>
    )
}
