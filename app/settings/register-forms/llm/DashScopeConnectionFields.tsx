/**
 * DashScope LLM Register 共用：可选 Base URL + 可选思考 Token 上限。
 * SKU 表单可分别引用 Base URL 与 Token 上限，在中间插入「思考模式」等服务端配置说明。
 */
'use client'

import { DASHSCOPE_COMPAT_BASE_MAINLAND } from '@lib/providers/registers/_shared/alibaba-dashscope-shared'

interface BaseUrlProps {
    baseURL: string
    setBaseURL: (v: string) => void
}

export function DashScopeBaseUrlFields({
    baseURL,
    setBaseURL,
}: BaseUrlProps) {
    return (
        <fieldset className="fieldset">
            <legend className="fieldset-legend">Base URL（可选）</legend>
            <input
                className="input input-bordered w-full font-mono text-sm"
                placeholder={`留空则用中国内地默认 ${DASHSCOPE_COMPAT_BASE_MAINLAND}`}
                value={baseURL}
                onChange={e => setBaseURL(e.target.value)}
            />
            <p className="mt-1 text-xs text-base-content/60">
                中国内地可显式填写
                {' '}
                {DASHSCOPE_COMPAT_BASE_MAINLAND}
                ；国际地域请按需覆盖。
            </p>
        </fieldset>
    )
}

interface ThinkingBudgetProps {
    thinkingBudget: string
    setThinkingBudget: (v: string) => void
}

export function DashScopeThinkingBudgetFields({
    thinkingBudget,
    setThinkingBudget,
}: ThinkingBudgetProps) {
    return (
        <fieldset className="fieldset">
            <legend className="fieldset-legend">思考过程 Token 上限（可选）</legend>
            <input
                className="input input-bordered w-full font-mono text-sm"
                inputMode="numeric"
                placeholder="对应 API thinking_budget，留空表示由模型默认"
                value={thinkingBudget}
                onChange={e => setThinkingBudget(e.target.value)}
            />
        </fieldset>
    )
}

interface Props extends BaseUrlProps, ThinkingBudgetProps {}

export function DashScopeConnectionFields({
    baseURL,
    setBaseURL,
    thinkingBudget,
    setThinkingBudget,
}: Props) {
    return (
        <>
            <DashScopeBaseUrlFields baseURL={baseURL} setBaseURL={setBaseURL} />
            <DashScopeThinkingBudgetFields
                thinkingBudget={thinkingBudget}
                setThinkingBudget={setThinkingBudget}
            />
        </>
    )
}
