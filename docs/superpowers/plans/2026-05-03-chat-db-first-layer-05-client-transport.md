# Layer 05：`ChatPage` 窄 `prepareSendMessagesRequest`

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HTTP POST **仅**发送 SPEC **§4** `user-turn` / `tool-approval`，**不**含 `messages` 数组。依据 `node_modules/ai/src/ui/chat.ts`：**`addToolApprovalResponse` 将匹配的 tool part 设为 `state: 'approval-responded'` 且 `approval: { id, approved, reason }`**；自动重发时 `makeRequest({ trigger: 'submit-message', messageId: this.lastMessage?.id })`，故 **`messageId` 与最后一条 assistant `id` 一致**。

**Architecture：**抽 **[`lib/chat/narrow-chat-transport-body.ts`](../../lib/chat/narrow-chat-transport-body.ts)**（纯函数 + Vitest），`ChatPage` 只拼接 `conversationId`。**`regenerate-message`** 本 Toy 明确 **不支持**，调用时 **抛错**以免静默发脏 body。

**Tech Stack：** `DefaultChatTransport`、`UIMessage`（`ai`）、Layer 03 `chatPostBodySchema` 形状对齐。

---

## 文件结构（本层）

| 文件                                                                                                           | 职责 |
| -------------------------------------------------------------------------------------------------------------- | ---- |
| Create: [`lib/chat/narrow-chat-transport-body.ts`](../../lib/chat/narrow-chat-transport-body.ts)               |
| Create: [`tests/chat/narrow-chat-transport-body.test.ts`](../../tests/chat/narrow-chat-transport-body.test.ts) |
| Modify: [`app/conversations/[id]/ChatPage.tsx`](../../app/conversations/[id]/ChatPage.tsx)                     |

---

## Task 1：`narrow-chat-transport-body.ts`（TDD）

**Files:**

- Create: [`lib/chat/narrow-chat-transport-body.ts`](../../lib/chat/narrow-chat-transport-body.ts)

- [ ] **Step 1：写入完整实现**

```typescript
/**
 * 从 useChat 内存 messages 构造与 chatPostBodySchema 一致的窄 POST body。
 * 依据 AI SDK：审批后 part 为 state === 'approval-responded'，approval: { id, approved, reason }。
 */
import type { UIMessage } from 'ai'

export interface NarrowBodyOptions {
    conversationId: string
    trigger: 'submit-message' | 'regenerate-message'
    messageId: string | undefined
    messages: UIMessage[]
}

export type NarrowChatPostBody
    = | {
        kind: 'user-turn'
        conversationId: string
        messageId: string
        parts: unknown[]
    }
    | {
        kind: 'tool-approval'
        conversationId: string
        assistantMessageId: string
        approvals: Array<{ approvalId: string, approved: boolean, reason?: string }>
    }

export function collectApprovalsFromAssistantMessage(msg: UIMessage): Array<{ approvalId: string, approved: boolean, reason?: string }> {
    const out: Array<{ approvalId: string, approved: boolean, reason?: string }> = []
    for (const p of msg.parts) {
        if (typeof p !== 'object' || p === null)
            continue
        const part = p as Record<string, unknown>
        if (part.state !== 'approval-responded')
            continue
        const ap = part.approval as { id?: string, approved?: boolean, reason?: string } | undefined
        if (ap?.id == null || typeof ap.approved !== 'boolean')
            continue
        out.push({ approvalId: ap.id, approved: ap.approved, ...(ap.reason != null ? { reason: ap.reason } : {}) })
    }
    return out
}

export function buildNarrowChatPostBody(o: NarrowBodyOptions): NarrowChatPostBody {
    if (o.trigger === 'regenerate-message')
        throw new Error('regenerate-message 未在窄 body 规格中实现')

    const last = o.messages.at(-1)
    if (!last)
        throw new Error('无消息可发送')

    const assistantApprovalRound
        = o.trigger === 'submit-message'
            && o.messageId != null
            && last.role === 'assistant'
            && last.id === o.messageId

    if (assistantApprovalRound) {
        const approvals = collectApprovalsFromAssistantMessage(last)
        if (approvals.length === 0)
            throw new Error('未找到 approval-responded 的 tool part')
        return {
            kind: 'tool-approval',
            conversationId: o.conversationId,
            assistantMessageId: o.messageId,
            approvals,
        }
    }

    if (last.role !== 'user')
        throw new Error('当前仅支持 user 发送或 assistant 审批后的自动提交')

    return {
        kind: 'user-turn',
        conversationId: o.conversationId,
        messageId: last.id,
        parts: last.parts as unknown[],
    }
}
```

- [ ] **Step 2：Commit**

```bash
git add lib/chat/narrow-chat-transport-body.ts
git commit -m "feat(chat): build narrow POST body from useChat state"
```

---

## Task 2：`narrow-chat-transport-body.test.ts`

**Files:**

- Create: [`tests/chat/narrow-chat-transport-body.test.ts`](../../tests/chat/narrow-chat-transport-body.test.ts)

- [ ] **Step 1：写入**

```typescript
import type { UIMessage } from 'ai'
import { buildNarrowChatPostBody } from '@lib/chat/narrow-chat-transport-body'
import { describe, expect, it } from 'vitest'

describe('buildNarrowChatPostBody', () => {
    it('user-turn: last user message', () => {
        const messages = [
            { id: 'a1', role: 'assistant', parts: [] },
            { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
        ] as UIMessage[]
        const body = buildNarrowChatPostBody({
            conversationId: 'c1',
            trigger: 'submit-message',
            messageId: 'u2',
            messages,
        })
        expect(body).toEqual({
            kind: 'user-turn',
            conversationId: 'c1',
            messageId: 'u2',
            parts: [{ type: 'text', text: 'hi' }],
        })
    })

    it('tool-approval: approval-responded parts', () => {
        const messages = [
            {
                id: 'as1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-image-generate-primary',
                        state: 'approval-responded',
                        toolCallId: 'tc1',
                        approval: { id: 'ap1', approved: true, reason: undefined },
                        input: { prompt: 'x' },
                    },
                ],
            },
        ] as unknown as UIMessage[]
        const body = buildNarrowChatPostBody({
            conversationId: 'c1',
            trigger: 'submit-message',
            messageId: 'as1',
            messages,
        })
        expect(body.kind).toBe('tool-approval')
        if (body.kind === 'tool-approval') {
            expect(body.assistantMessageId).toBe('as1')
            expect(body.approvals).toEqual([{ approvalId: 'ap1', approved: true }])
        }
    })

    it('rejects regenerate', () => {
        expect(() =>
            buildNarrowChatPostBody({
                conversationId: 'c1',
                trigger: 'regenerate-message',
                messageId: 'x',
                messages: [{ id: 'u', role: 'user', parts: [] }] as UIMessage[],
            }),
        ).toThrow()
    })
})
```

- [ ] **Step 2：运行**

```bash
bun test tests/chat/narrow-chat-transport-body.test.ts
```

Expected: PASS

- [ ] **Step 3：Commit**

```bash
git add tests/chat/narrow-chat-transport-body.test.ts
git commit -m "test(chat): narrow chat POST body builder"
```

---

## Task 3：接入 `ChatPage.tsx`

**Files:**

- Modify: [`app/conversations/[id]/ChatPage.tsx`](../../app/conversations/[id]/ChatPage.tsx)

- [ ] **Step 1：增加 import**

```typescript
import { buildNarrowChatPostBody } from '@lib/chat/narrow-chat-transport-body'
```

- [ ] **Step 2：替换 `prepareSendMessagesRequest`（保留 `api: '/api/chat'`）**

```typescript
            prepareSendMessagesRequest: ({ messages, trigger, messageId }) => ({
                body: buildNarrowChatPostBody({
                    conversationId,
                    trigger,
                    messageId,
                    messages,
                }),
            }),
```

- [ ] **Step 3：`bun run lint:fix` 与对话页 smoke**（需 Layer 04 已部署窄路由）。

- [ ] **Step 4：Commit**

```bash
git add app/conversations/[id]/ChatPage.tsx
git commit -m "feat(chat): send narrow body from ChatPage transport"
```

---

## Task 4：与 Layer 04 审批语义对齐

- [ ] **Step 1：服务端 [`applyToolApprovalsToParts`](../../lib/ai/tool-approval-parts.ts) 以 HTTP **`approvals`** 为准，将 DB 中仍为 **`approval-requested`** 的 part 按 `approved`/`reason` 推进；**不必\*\*解析 `approval-responded`（该态仅存于客户端自动提交前内存）。

---

## Spec 覆盖（Layer 05）

G2、§4、§4.4

---

Plan complete. **Two execution options:**

**1. Subagent-Driven (recommended)** — `superpowers:subagent-driven-development`
**2. Inline Execution** — `superpowers:executing-plans`

Which approach?
