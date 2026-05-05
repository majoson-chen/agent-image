# Layer 03：POST `/api/chat` 窄请求体 Zod 契约

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Zod **可判别联合** 替换 [`lib/validation/chat-post-schema.ts`](../../lib/validation/chat-post-schema.ts)，实现 SPEC **§4**：`conversationId`、`kind: 'user-turn' | 'tool-approval'`、各分支字段与禁止项；**`approvals` 为数组**，允许多项（每项 `approvalId` + `approved` + 可选 `reason`）。导出 `ChatPostBodyInput` 供 Layer 04 使用。

**Architecture:** `z.discriminatedUnion('kind', [...])`；`user-turn.parts` 为 `z.array(z.unknown())`（与 UIMessage 对齐，不在本层 deep-refine part 形状）；**不**接受顶层 `messages` 数组进入 **合法** body（若需迁移期兼容可在 Layer 04 **显式**strip，本层 schema **不包含** `messages`）。

**Tech Stack:** `zod@` 与仓库一致、`vitest`、权威 SPEC §4。

---

## 文件结构（本层）

| 文件                                                                                                   | 职责 |
| ------------------------------------------------------------------------------------------------------ | ---- |
| Modify: [`lib/validation/chat-post-schema.ts`](../../lib/validation/chat-post-schema.ts)               |
| Create: [`tests/validation/chat-post-schema.test.ts`](../../tests/validation/chat-post-schema.test.ts) |

---

## Task 1：重写 `chat-post-schema.ts`

**Files:**

- Modify: [`lib/validation/chat-post-schema.ts`](../../lib/validation/chat-post-schema.ts)

- [ ] **Step 1：整体替换文件为**

```typescript
import { z } from 'zod'

/** SPEC §4.2 user-turn：parts 与 UIMessage 同构，本层只做数组级校验 */
const userTurnSchema = z.object({
    kind: z.literal('user-turn'),
    conversationId: z.string().min(1),
    messageId: z.string().min(1),
    parts: z.array(z.unknown()),
    role: z.literal('user').optional(),
})

const approvalItemSchema = z.object({
    approvalId: z.string().min(1),
    approved: z.boolean(),
    reason: z.string().optional(),
})

/** SPEC §4.3 tool-approval */
const toolApprovalSchema = z.object({
    kind: z.literal('tool-approval'),
    conversationId: z.string().min(1),
    assistantMessageId: z.string().min(1),
    approvals: z.array(approvalItemSchema).min(1),
})

export const chatPostBodySchema = z.discriminatedUnion('kind', [userTurnSchema, toolApprovalSchema])

export type ChatPostBodyInput = z.infer<typeof chatPostBodySchema>
export type ChatPostUserTurnInput = z.infer<typeof userTurnSchema>
export type ChatPostToolApprovalInput = z.infer<typeof toolApprovalSchema>
```

- [ ] **Step 2：Lint**

```bash
bun run lint:fix
```

Expected: 无 error。

- [ ] **Step 3：Commit**

```bash
git add lib/validation/chat-post-schema.ts
git commit -m "feat(validation): narrow chat POST body user-turn and tool-approval"
```

---

## Task 2：新增 `chat-post-schema.test.ts`（TDD）

**Files:**

- Create: [`tests/validation/chat-post-schema.test.ts`](../../tests/validation/chat-post-schema.test.ts)

- [ ] **Step 1：写入下列完整文件**

```typescript
import { chatPostBodySchema } from '@lib/validation/chat-post-schema'
import { describe, expect, it } from 'vitest'

describe('chatPostBodySchema', () => {
    it('parses user-turn with messageId and parts', () => {
        const raw = {
            kind: 'user-turn',
            conversationId: 'c1',
            messageId: 'u1',
            parts: [{ type: 'text', text: 'hi' }],
        }
        const r = chatPostBodySchema.safeParse(raw)
        expect(r.success).toBe(true)
        if (r.success)
            expect(r.data.kind).toBe('user-turn')
    })

    it('rejects user-turn without messageId', () => {
        const r = chatPostBodySchema.safeParse({
            kind: 'user-turn',
            conversationId: 'c1',
            parts: [],
        })
        expect(r.success).toBe(false)
    })

    it('parses tool-approval with multiple approvals', () => {
        const raw = {
            kind: 'tool-approval',
            conversationId: 'c1',
            assistantMessageId: 'a1',
            approvals: [
                { approvalId: 'ap1', approved: true },
                { approvalId: 'ap2', approved: false, reason: 'no' },
            ],
        }
        const r = chatPostBodySchema.safeParse(raw)
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.data.kind).toBe('tool-approval')
            expect(r.data.approvals).toHaveLength(2)
        }
    })

    it('rejects tool-approval with empty approvals', () => {
        const r = chatPostBodySchema.safeParse({
            kind: 'tool-approval',
            conversationId: 'c1',
            assistantMessageId: 'a1',
            approvals: [],
        })
        expect(r.success).toBe(false)
    })

    it('rejects legacy body with only messages array', () => {
        const r = chatPostBodySchema.safeParse({
            conversationId: 'c1',
            messages: [{ id: '1', role: 'user', parts: [] }],
        })
        expect(r.success).toBe(false)
    })
})
```

- [ ] **Step 2：运行测试**

```bash
bun test tests/validation/chat-post-schema.test.ts
```

Expected: **全部 PASS**

- [ ] **Step 3：Commit**

```bash
git add tests/validation/chat-post-schema.test.ts
git commit -m "test(validation): chat POST narrow body schema"
```

---

## Task 3：预估 Layer 04 破坏点（本层不修改）

- [ ] **Step 1：列出当前 `chatPostBodySchema` 引用**

```bash
rg "chatPostBodySchema|ChatPostBodyInput" --glob '*.ts' --glob '*.tsx'
```

Expected: [`app/api/chat/route.ts`](../../app/api/chat/route.ts) 等 —— **在 Layer 04 统一改**；合并本层后 **`bun test` 全仓可能失败`route.test.ts`**，可接受直至 Layer 04。

---

## Spec 覆盖（Layer 03）

| ID               | 本层                    |
| ---------------- | ----------------------- |
| G2、G4（校验侧） | discriminated `kind`    |
| §4.1–4.3         | 字段与 `approvals` 数组 |

---

Plan complete. **Two execution options:**

**1. Subagent-Driven (recommended)** — `superpowers:subagent-driven-development`
**2. Inline Execution** — `superpowers:executing-plans`

Which approach?
