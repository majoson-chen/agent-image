/**
 * Client：拆解后的 LLM 添加表单共用校验与小工具。
 */
'use client'

/** 为空表示合法；非空必须为正整数。 */
export function validateThinkingBudgetOrEmpty(trimmed: string): string | null {
    if (trimmed === '')
        return null
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n))
        return '思考 Token 上限须为正整数'
    return null
}
