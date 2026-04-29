import { z } from 'zod'

/** 与 UI、Agent 工具共用 */
export const CONVERSATION_TITLE_MAX = 120

const schema = z.string().trim().min(1, '标题不能为空').max(CONVERSATION_TITLE_MAX, `标题最多 ${CONVERSATION_TITLE_MAX} 字符`)

export function parseConversationTitle(raw: unknown):
    | { ok: true, title: string }
    | { ok: false, message: string } {
    const r = schema.safeParse(raw)
    if (!r.success)
        return { ok: false, message: r.error.issues[0]?.message ?? '标题无效' }
    return { ok: true, title: r.data }
}
