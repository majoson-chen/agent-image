/**
 * Register `alibaba/dashscope-qwen3-6-plus` — 新建 LLM 模型表单。
 */
'use client'

import type { LlmRegisterFormProps } from '@lib/settings/llm-register-form-loaders'
import { cn } from '@lib/cn'
import { DASHSCOPE_QWEN36_PLUS_DOC } from '@lib/providers/registers/_shared/alibaba-dashscope-shared'
import { validateThinkingBudgetOrEmpty } from '@lib/settings/llm-register-form-helpers'
import { postCreateLlmModel } from '@lib/settings/post-create-llm-model'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
    DashScopeBaseUrlFields,
    DashScopeThinkingBudgetFields,
} from './DashScopeConnectionFields'

const REGISTER_ID = 'alibaba/dashscope-qwen3-6-plus' as const

export default function AlibabaDashscopeQwen36PlusModelForm(props: LlmRegisterFormProps) {
    const router = useRouter()
    const [displayName, setDisplayName] = useState('')
    const [baseURL, setBaseURL] = useState('')
    const [thinkingBudget, setThinkingBudget] = useState('')
    const [enableThinking, setEnableThinking] = useState(true)
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
        }
        const b = baseURL.trim()
        if (b)
            config.baseURL = b

        const capabilities: Record<string, unknown> = {}
        capabilities.supportsThinking = enableThinking
        if (budgetTrim !== '')
            capabilities.thinkingBudget = Number.parseInt(budgetTrim, 10)

        config.capabilities = capabilities

        const payload = {
            type: 'LLM',
            name: displayName.trim(),
            registerId: REGISTER_ID,
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

    const doc = DASHSCOPE_QWEN36_PLUS_DOC

    return (
        <form className="grid gap-3" onSubmit={handleSubmit}>
            {error && (
                <div className="alert alert-error py-2 text-sm">{error}</div>
            )}

            <fieldset className="fieldset">
                <legend className="fieldset-legend">显示名称</legend>
                <input
                    className="input input-bordered w-full"
                    placeholder="设置列表中的名称（如「团队 Qwen Plus」）"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                />
            </fieldset>

            <p className="text-xs text-base-content/65">
                已锁定 API model=
                {' '}
                <code className="mx-1 font-mono text-[11px]">{doc.modelId}</code>
                ，SKU 文档：
                {' '}
                <a
                    href={doc.docUrl}
                    className="link link-primary"
                    target="_blank"
                    rel="noreferrer"
                >
                    VL Plus 快速入门
                </a>
                ；上下文与配额以模型大全为准：
                {' '}
                <a
                    href="https://help.aliyun.com/zh/model-studio/models"
                    className="link link-primary"
                    target="_blank"
                    rel="noreferrer"
                >
                    models
                </a>
                。
            </p>

            <DashScopeBaseUrlFields baseURL={baseURL} setBaseURL={setBaseURL} />

            <fieldset className="fieldset">
                <legend className="fieldset-legend">思考模式（百炼）</legend>
                <p className="mb-3 text-xs text-base-content/65">
                    是否在请求中启用思考由此处决定（对话页不再切换）。开关对应 API 侧的
                    {' '}
                    <code className="font-mono text-[11px]">enable_thinking</code>
                    ；下方可选填写
                    {' '}
                    <code className="font-mono text-[11px]">thinking_budget</code>
                    。
                </p>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2">
                    <span className="text-sm text-base-content">启用思考模式</span>
                    <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={enableThinking}
                        onChange={e => setEnableThinking(e.target.checked)}
                    />
                </label>
            </fieldset>

            <DashScopeThinkingBudgetFields
                thinkingBudget={thinkingBudget}
                setThinkingBudget={setThinkingBudget}
            />

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
