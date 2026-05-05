# Layer 02：消息仓储、`initialMessages` 与 DB 层测试

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 [`lib/db/messages.ts`](../../lib/db/messages.ts)、[`lib/conversations/initial-messages.ts`](../../lib/conversations/initial-messages.ts) 及 [`tests/db/messages.test.ts`](../../tests/db/messages.test.ts) 全面切换到 Layer 01 冻结的 **`payload` JSON**；**表级 `role` 与 `payload.role` 写入时保持一致**；`aggregateUsage` 改为扫 `payload.metadata.usage`；满足 SPEC **G1、G3、G7** 对 DB 作为历史源的要求。

**Architecture:** 新增小模块 **[`lib/db/message-payload.ts`](../../lib/db/message-payload.ts)** 存放 `MessagePayload` 类型与 **`toMessageRoleEnum`** / **`parseMessagePayload`** 辅助函数，避免 `messages.ts` 内联重复。所有 `upsert` 写入构造完整 `payload` 对象；**不再**写 `content` / `parts` / 分列 usage。

**Tech Stack:** Prisma、`PrismaClient`、`bun test`、`vitest`。依赖 Layer 01 已合并。

---

## 文件结构（本层）

| 文件                                                                                           | 职责                            |
| ---------------------------------------------------------------------------------------------- | ------------------------------- |
| Create: [`lib/db/message-payload.ts`](../../lib/db/message-payload.ts)                         | 类型 + role 枚举映射            |
| Modify: [`lib/db/messages.ts`](../../lib/db/messages.ts)                                       | CRUD / upsert / aggregate       |
| Modify: [`lib/conversations/initial-messages.ts`](../../lib/conversations/initial-messages.ts) | 从 `row.payload` 映射 UIMessage |
| Modify: [`tests/db/messages.test.ts`](../../tests/db/messages.test.ts)                         | 断言 `payload`                  |

---

## Task 1：新增 `message-payload.ts`

**Files:**

- Create: [`lib/db/message-payload.ts`](../../lib/db/message-payload.ts)

- [ ] **Step 1：写入下列完整文件**

```typescript
/**
 * Message.payload 形状 — 与 Layer 01 迁移与 SPEC §10.3 一致。
 */
import type { MessageRole } from '~/generated/prisma/enums'

export type MessagePayloadRole = 'user' | 'assistant' | 'system'

export interface MessagePayloadMetadata {
    usage?: {
        inputTokens: number | null
        outputTokens: number | null
        totalTokens: number | null
    }
    modelIdAtTime?: string | null
}

export interface MessagePayload {
    role: MessagePayloadRole
    parts: unknown[]
    metadata?: MessagePayloadMetadata
}

export function toMessageRoleEnum(role: MessagePayloadRole): MessageRole {
    if (role === 'user')
        return 'USER'
    if (role === 'assistant')
        return 'ASSISTANT'
    return 'SYSTEM'
}

export function payloadRoleFromEnum(role: MessageRole): MessagePayloadRole {
    if (role === 'USER')
        return 'user'
    if (role === 'ASSISTANT')
        return 'assistant'
    return 'system'
}

export function parseMessagePayload(raw: unknown): MessagePayload {
    if (typeof raw !== 'object' || raw === null || !('role' in raw) || !('parts' in raw))
        throw new Error('无效 Message payload')
    const o = raw as Record<string, unknown>
    const role = o.role as MessagePayloadRole
    const parts = o.parts as unknown[]
    const metadata = o.metadata as MessagePayloadMetadata | undefined
    return { role, parts, metadata }
}
```

- [ ] **Step 2：Lint**

```bash
bun run lint:fix
```

- [ ] **Step 3：Commit**

```bash
git add lib/db/message-payload.ts
git commit -m "feat(db): MessagePayload types and role helpers"
```

---

## Task 2：重构 `lib/db/messages.ts`

**Files:**

- Modify: [`lib/db/messages.ts`](../../lib/db/messages.ts)

- [ ] **Step 1：将文件顶部的 import 改为**

```typescript
import type { MessagePayload } from '@lib/db/message-payload'
import type { PrismaClient } from '~/generated/prisma/client'
import {

    parseMessagePayload,
    toMessageRoleEnum
} from '@lib/db/message-payload'
```

- [ ] **Step 2：实现 `buildPayloadForUser(parts: unknown[])` 与 `buildPayloadForAssistant`**

在 **`UsageInput` 接口之后**、`listMessages` **之前**插入（并 **删除** 不再使用的 `extractTextContent` 整段）：

```typescript
function buildPayloadForUser(parts: unknown[]): MessagePayload {
    return {
        role: 'user',
        parts,
        metadata: {},
    }
}

function buildPayloadForAssistant(
    parts: unknown[],
    usage: UsageInput,
    modelIdAtTime: string | null,
): MessagePayload {
    const hasUsage = usage.totalTokens != null
    return {
        role: 'assistant',
        parts,
        metadata: {
            ...(hasUsage
                ? {
                        usage: {
                            inputTokens: usage.inputTokens,
                            outputTokens: usage.outputTokens,
                            totalTokens: usage.totalTokens,
                        },
                    }
                : {}),
            modelIdAtTime,
        },
    }
}
```

- [ ] **Step 3：替换 `appendUserMessage`**

```typescript
export async function appendUserMessage(
    prisma: PrismaClient,
    conversationId: string,
    content: string,
) {
    const parts: object[] = [{ type: 'text', text: content }]
    const payload = buildPayloadForUser(parts)
    return prisma.message.create({
        data: {
            conversationId,
            role: toMessageRoleEnum('user'),
            payload,
        },
    })
}
```

- [ ] **Step 4：替换 `createUserMessageWithParts`**

```typescript
export async function createUserMessageWithParts(
    prisma: PrismaClient,
    conversationId: string,
    parts: object[],
) {
    const payload = buildPayloadForUser(parts)
    return prisma.message.create({
        data: {
            id: crypto.randomUUID(),
            conversationId,
            role: toMessageRoleEnum('user'),
            payload,
        },
    })
}
```

- [ ] **Step 5：替换 `upsertUserMessageParts`**

```typescript
export async function upsertUserMessageParts(
    prisma: PrismaClient,
    conversationId: string,
    input: { id: string, parts: unknown[] },
) {
    const parts = input.parts as object[]
    const payload = buildPayloadForUser(parts)
    return prisma.message.upsert({
        where: { id: input.id },
        create: {
            id: input.id,
            conversationId,
            role: toMessageRoleEnum('user'),
            payload,
        },
        update: {
            role: toMessageRoleEnum('user'),
            payload,
        },
    })
}
```

- [ ] **Step 6：替换 `upsertAssistantMessage`**

```typescript
export async function upsertAssistantMessage(
    prisma: PrismaClient,
    input: UpsertAssistantMessageInput,
) {
    const payload = buildPayloadForAssistant(
        input.parts as unknown[],
        input.usage,
        input.modelIdAtTime,
    )
    return prisma.message.upsert({
        where: { id: input.id },
        create: {
            id: input.id,
            conversationId: input.conversationId,
            role: toMessageRoleEnum('assistant'),
            payload,
        },
        update: {
            payload,
        },
    })
}
```

- [ ] **Step 7：替换 `appendAssistantMessage`**

```typescript
export async function appendAssistantMessage(
    prisma: PrismaClient,
    conversationId: string,
    content: string,
    usage: UsageInput,
    modelIdAtTime: string | null,
) {
    const parts: object[] = [{ type: 'text', text: content }]
    const payload = buildPayloadForAssistant(parts, usage, modelIdAtTime)
    return prisma.message.create({
        data: {
            conversationId,
            role: toMessageRoleEnum('assistant'),
            payload,
        },
    })
}
```

- [ ] **Step 8：替换 `aggregateUsage`**

```typescript
export async function aggregateUsage(
    prisma: PrismaClient,
    conversationId: string,
): Promise<{ inputTokens: number, outputTokens: number, totalTokens: number } | null> {
    const msgs = await prisma.message.findMany({
        where: { conversationId },
        select: { payload: true },
    })

    let inputTokens = 0
    let outputTokens = 0
    let totalTokens = 0
    let anyUsage = false

    for (const m of msgs) {
        const payload = parseMessagePayload(m.payload)
        const u = payload.metadata?.usage
        if (u?.totalTokens != null) {
            anyUsage = true
            inputTokens += u.inputTokens ?? 0
            outputTokens += u.outputTokens ?? 0
            totalTokens += u.totalTokens ?? 0
        }
    }

    if (!anyUsage)
        return null

    return { inputTokens, outputTokens, totalTokens }
}
```

- [ ] **Step 9：`syncIncomingClientUserMessages`** — 保持循环逻辑不变；仍调用 `upsertUserMessageParts`（已实现 payload）。

- [ ] **Step 10：确认 `extractTextContent` 已删除且文件无未使用 import**

- [ ] **Step 11：Commit**

```bash
git add lib/db/messages.ts
git commit -m "refactor(db): persist messages via payload JSON"
```

---

## Task 3：更新 `initial-messages.ts`

**Files:**

- Modify: [`lib/conversations/initial-messages.ts`](../../lib/conversations/initial-messages.ts)

- [ ] **Step 1：替换为**

```typescript
/** SSR 重载时把 DB Message 行转换为 UIMessage 初始值 */

import { parseMessagePayload } from '@lib/db/message-payload'

interface DbMessageRow {
    id: string
    role: string
    payload: unknown
}

interface MappedMessage {
    id: string
    role: 'user' | 'assistant'
    parts: object[]
}

export function mapDbMessagesToInitialMessages(messages: DbMessageRow[]): MappedMessage[] {
    return messages.map((m) => {
        const payload = parseMessagePayload(m.payload)
        const role = payload.role as 'user' | 'assistant'
        const parts = Array.isArray(payload.parts)
            ? payload.parts as object[]
            : [{ type: 'text' as const, text: '' }]
        return { id: m.id, role, parts }
    })
}
```

- [ ] **Step 2：搜索调用方**，确保传入对象含 `payload`（Prisma `listMessages` 已返回整行）。

```bash
rg "mapDbMessagesToInitialMessages" -n
```

- [ ] **Step 3：Commit**

```bash
git add lib/conversations/initial-messages.ts
git commit -m "refactor(conversations): map initial messages from payload"
```

---

## Task 4：更新 `tests/db/messages.test.ts`

**Files:**

- Modify: [`tests/db/messages.test.ts`](../../tests/db/messages.test.ts)

- [ ] **Step 1：在 `upsertAssistantMessage` 断言中，将 `msgs[0].parts` 改为从 payload 取**

```typescript
const row = msgs[0]
const payload = row.payload as { parts: unknown[] }
expect(payload.parts).toEqual(parts)
```

- [ ] **Step 2：将 `usageTotalTokens` 断言改为**

```typescript
const p = msgs[0].payload as { metadata?: { usage?: { totalTokens?: number | null } } }
expect(p.metadata?.usage?.totalTokens).toBe(24)
```

- [ ] **Step 3：将 `content` 相关断言改为扫 `payload.parts` 文本**

```typescript
const p = msgs[0].payload as { parts: Array<{ type: string, text?: string }> }
const text = p.parts.filter(x => x.type === 'text').map(x => x.text ?? '').join('')
expect(text).toBe('First Second')
```

`empty parts` 用例同理：`expect(text).toBe('')`

- [ ] **Step 4：重写 `listMessages parts field` describe**

改名为 `message payload parts`；删除「m1 legacy parts=null」——已无处存 null parts；改为「无 text part 时仍返回空数组或占位」按 `mapDbMessagesToInitialMessages` 约定测 SSR，或删除该 it 若冗余。

最小改动：删除原 `prisma.message.create` 模拟 M1 的 it，或改为直接 create payload `parts: []` 并断言 listMessages 返回 `payload.parts` 为 `[]`。

- [ ] **Step 5：运行测试**

```bash
bun test tests/db/messages.test.ts
```

Expected: PASS

- [ ] **Step 6：Commit**

```bash
git add tests/db/messages.test.ts
git commit -m "test(db): assert Message payload shape in messages layer"
```

---

## Task 5：`rg` 清扫遗留 `\.content` / `usageTotalTokens` 于 `lib/db`

```bash
rg "\.content|usageTotalTokens|m\.parts" lib/db/ lib/conversations/
```

- [ ] **Step 1：除本文档预期路径外无 Message 旧列访问**

---

## Spec 覆盖（Layer 02）

| ID  | 本层                                          |
| --- | --------------------------------------------- |
| G1  | `listMessages` + `payload` 可作为唯一历史源   |
| G3  | `upsertUserMessageParts` 仍以客户端 id upsert |
| G7  | 读写符合 §10 `payload`                        |

---

Plan complete. **Two execution options:**

**1. Subagent-Driven (recommended)** — `superpowers:subagent-driven-development`
**2. Inline Execution** — `superpowers:executing-plans`

Which approach?
