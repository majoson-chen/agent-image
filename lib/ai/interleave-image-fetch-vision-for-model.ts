/**
 * DB 按 createdAt 排序时，image-fetch 合成 user 行会落在「同轮 assistant」行之后；
 * 但 assistant.parts 已含 tool 之后生成的文本，刷新后模型读到的是 assistant(全文) → vision，与
 * prepareStep 运行时顺序相反。本模块在仅服务端喂模型前将列表调整为：assistant(至 tool 止) → vision user → assistant(余下)。
 */
import { isImageFetchVisionPersistParts } from '@lib/ai/vision-inject-xml'
import 'server-only'

function parseVisionBatchToolCallIdsFromParts(parts: object[]): Set<string> {
    const head = parts[0]
    if (!head || typeof head !== 'object')
        return new Set()
    const h = head as { type?: string, text?: string }
    if (h.type !== 'text' || typeof h.text !== 'string')
        return new Set()
    const ids = new Set<string>()
    const re = /toolCallId="([^"]+)"/g
    let m = re.exec(h.text)
    while (m !== null) {
        ids.add(m[1]!)
        m = re.exec(h.text)
    }
    return ids
}

function partIsImageFetchOutputForIds(p: object, toolCallIds: Set<string>): boolean {
    if (toolCallIds.size === 0)
        return false
    const x = p as Record<string, unknown>
    if (x.state !== 'output-available' || typeof x.toolCallId !== 'string')
        return false
    if (!toolCallIds.has(x.toolCallId))
        return false
    if (x.type === 'tool-image-fetch')
        return true
    return x.type === 'dynamic-tool' && x.toolName === 'image-fetch'
}

/** 在最后一个匹配的 image-fetch tool part 之后切开；若无匹配或 post 为空则不切分 */
function splitAssistantAtImageFetch(parts: object[], toolCallIds: Set<string>): { pre: object[], post: object[] } {
    let splitIdx = -1
    for (let i = 0; i < parts.length; i++) {
        if (partIsImageFetchOutputForIds(parts[i]!, toolCallIds))
            splitIdx = i
    }
    if (splitIdx === -1)
        return { pre: parts, post: [] }
    const post = parts.slice(splitIdx + 1)
    if (post.length === 0)
        return { pre: parts, post: [] }
    return { pre: parts.slice(0, splitIdx + 1), post }
}

export interface UiLikeMessage { id: string, role: 'user' | 'assistant', parts: object[] }

export function interleaveImageFetchVisionForModel(messages: UiLikeMessage[]): UiLikeMessage[] {
    const out: UiLikeMessage[] = []
    for (const m of messages) {
        if (
            m.role === 'user'
            && isImageFetchVisionPersistParts(m.parts)
            && out.length > 0
            && out[out.length - 1]!.role === 'assistant'
        ) {
            const assistant = out.pop()!
            const toolCallIds = parseVisionBatchToolCallIdsFromParts(m.parts)
            const { pre, post } = splitAssistantAtImageFetch(assistant.parts, toolCallIds)
            if (post.length === 0) {
                out.push(assistant, m)
                continue
            }
            const postId = `${assistant.id}__vision_post__${[...toolCallIds].sort().join('_')}`
            out.push(
                { id: assistant.id, role: 'assistant', parts: pre },
                m,
                { id: postId, role: 'assistant', parts: post },
            )
            continue
        }
        out.push(m)
    }
    return out
}
