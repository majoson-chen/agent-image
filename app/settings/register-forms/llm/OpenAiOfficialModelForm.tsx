/**
 * Register `openai/official` — 新建 LLM 模型表单。
 */
'use client'

import type { LlmRegisterFormProps } from '@lib/settings/llm-register-form-loaders'
import { cn } from '@lib/cn'
import { postCreateLlmModel } from '@lib/settings/post-create-llm-model'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function OpenAiOfficialModelForm(props: LlmRegisterFormProps) {
    const router = useRouter()
    const [displayName, setDisplayName] = useState('')
    const [modelId, setModelId] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const payload = {
            type: 'LLM',
            name: displayName.trim(),
            registerId: 'openai/official',
            config: {
                modelId: modelId.trim(),
                apiKey: apiKey.trim(),
            },
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
                    placeholder="设置列表中的名称（如「团队 GPT」）"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                />
            </fieldset>

            <fieldset className="fieldset">
                <legend className="fieldset-legend">API 模型 ID</legend>
                <input
                    className="input input-bordered w-full font-mono text-sm"
                    placeholder="如 gpt-4o"
                    value={modelId}
                    onChange={e => setModelId(e.target.value)}
                    required
                />
            </fieldset>

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
