/**
 * Client：POST `/api/models`（LLM 创建）。
 */
'use client'

export type CreateLlmModelResult = { ok: true } | { ok: false, message: string }

export async function postCreateLlmModel(
    payload: Record<string, unknown>,
): Promise<CreateLlmModelResult> {
    const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (res.ok)
        return { ok: true }

    const data = await res.json().catch(() => ({}))
    const msgs = (data.errors as Array<{ message: string }> | undefined)
        ?.map(e => e.message)
        .join('；')
    return { ok: false, message: msgs ?? '创建失败' }
}
