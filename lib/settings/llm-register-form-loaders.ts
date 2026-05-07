/**
 * Client：LLM Register → 动态 import 设置表单元。
 */
'use client'

import type { ComponentType } from 'react'

export interface LlmRegisterFormProps {
    onCancel: () => void
    onCreated: () => void
}

const loaders: Record<
    string,
    () => Promise<{ default: ComponentType<LlmRegisterFormProps> }>
> = {
    'openai/official': () =>
        import('@/settings/register-forms/llm/OpenAiOfficialModelForm'),
    'openai-compatible/generic': () =>
        import('@/settings/register-forms/llm/OpenAiCompatibleModelForm'),
    'alibaba/dashscope-llm': () =>
        import('@/settings/register-forms/llm/AlibabaDashscopeLlmModelForm'),
    'alibaba/dashscope-kimi-k2-6': () =>
        import('@/settings/register-forms/llm/AlibabaDashscopeKimiK26ModelForm'),
    'alibaba/dashscope-qwen3-6-plus': () =>
        import('@/settings/register-forms/llm/AlibabaDashscopeQwen36PlusModelForm'),
}

export function loadLlmRegisterFormModule(registerId: string) {
    const load = loaders[registerId]
    if (!load)
        throw new Error(`No settings form for LLM register: ${registerId}`)
    return load()
}
