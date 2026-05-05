# Layer 04：`/api/chat` 路由、DB 构图与 Agent 外圈

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 SPEC **§5–§6** 重写 [`app/api/chat/route.ts`](../../app/api/chat/route.ts)：`chatPostBodySchema` 的 **`user-turn` / `tool-approval`** 分支；**仅** `listMessages(DB) + 本请求增量` 构图（**删除** [`mergeClientMessagesWithDbForModel`](../../lib/ai/conversation-history-merge.ts) 的 import 与调用）；`continuingAssistant` 从 **`payload.parts` / `metadata.usage`** 恢复（Layer 02 [`parseMessagePayload`](../../lib/db/message-payload.ts)）；以 **`createUIMessageStream` + `writer.merge`** 做 **image-fetch 外圈循环**，移除 `prepareStep` 视觉注入；**执行前必读** `node_modules/ai/docs/` 中 `createUIMessageStream`、`ToolLoopAgent`、`validateUIMessages`、`convertToModelMessages`（**ai-sdk skill**）。

**Architecture:** 抽 **`dbRowsToUiMessagesForHydrate`**（新文件）把 `Message[]` → `{ id, role, parts }[]`（跳过 `SYSTEM`）；**`user-turn`**：`upsertUserMessageParts` → `listMessages` → hydrate → 流；**`tool-approval`**：`findUnique` assistant → `applyToolApprovalsToParts` → `upsertAssistantMessage`（仅更新 `payload`）→ **`runId = assistantMessageId`** 续跑。**外圈**：[`lib/ai/build-agent.ts`](../../lib/ai/build-agent.ts) 去掉 `prepareStep`；`stopWhen` 使用 **`stepCountIs(20)`** 与业务条件组合（**禁止**单独 `return false` 关死默认上限）。

**Tech Stack:** `ai` 包、`ToolLoopAgent`、`createUIMessageStreamResponse`、`NextResponse`、`Prisma`。

---

## 文件结构（本层）

| 文件                                                                                           | 职责                                                                                                     |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Create: [`lib/ai/db-rows-to-ui-messages.ts`](../../lib/ai/db-rows-to-ui-messages.ts)           | DB 行 → UI 消息（构图用）                                                                                |
| Create: [`lib/ai/tool-approval-parts.ts`](../../lib/ai/tool-approval-parts.ts)                 | 审批写回 parts                                                                                           |
| Modify: [`app/api/chat/route.ts`](../../app/api/chat/route.ts)                                 | 主流程                                                                                                   |
| Modify: [`lib/ai/build-agent.ts`](../../lib/ai/build-agent.ts)                                 | 仅当 route 不再传 `prepareStep` 时可删类型分支（可选缩窄）                                               |
| Modify: [`tests/api/chat/route.test.ts`](../../tests/api/chat/route.test.ts)（及同目录相关测） | 新 body                                                                                                  |
| **不删**                                                                                       | [`conversation-history-merge.ts`](../../lib/ai/conversation-history-merge.ts) 留待 Layer 06 若无引用再删 |

---

## Task 0：阅读 AI SDK（强制）

- [ ] **Step 1：grep 本地文档**

```bash
rg -l "createUIMessageStream" node_modules/ai/docs/ | head -5
rg -l "ToolLoopAgent" node_modules/ai/docs/ | head -5
```

- [ ] **Step 2：阅读** `node_modules/ai/docs/07-reference/02-ai-sdk-ui/40-create-ui-message-stream.mdx` 中与 **`writer.merge`**、`execute` 相关小节。

- [ ] **Step 3：阅读** `node_modules/ai/docs/07-reference/01-ai-sdk-core/18-create-agent-ui-stream-response.mdx`（对照当前 `createAgentUIStreamResponse` 可改写方式）。

---

## Task 1：新增 `db-rows-to-ui-messages.ts`

**Files:**

- Create: [`lib/ai/db-rows-to-ui-messages.ts`](../../lib/ai/db-rows-to-ui-messages.ts)

- [ ] **Step 1：写入**

```typescript
import type { Message } from '~/generated/prisma/client'
import { parseMessagePayload } from '@lib/db/message-payload'
import 'server-only'

/** 按 createdAt 序；跳过 SYSTEM；parts 来自 payload */
export function dbRowsToUiMessagesForHydrate(rows: Message[]): Array<{ id: string, role: 'user' | 'assistant', parts: object[] }> {
    const sorted = [...rows].sort((a, b) => {
        const t = a.createdAt.getTime() - b.createdAt.getTime()
        if (t !== 0)
            return t
        return a.id.localeCompare(b.id)
    })
    const out: Array<{ id: string, role: 'user' | 'assistant', parts: object[] }> = []
    for (const row of sorted) {
        if (row.role === 'SYSTEM')
            continue
        const payload = parseMessagePayload(row.payload)
        const role = payload.role === 'assistant' ? 'assistant' : 'user'
        const parts = Array.isArray(payload.parts) ? payload.parts as object[] : []
        out.push({ id: row.id, role, parts })
    }
    return out
}
```

- [ ] **Step 2：Commit**

```bash
git add lib/ai/db-rows-to-ui-messages.ts
git commit -m "feat(ai): map DB Message rows to UI messages for model"
```

---

## Task 2：新增 `tool-approval-parts.ts`

**Files:**

- Create: [`lib/ai/tool-approval-parts.ts`](../../lib/ai/tool-approval-parts.ts)

- [ ] **Step 1：写入（若与 SDK 状态名不一致，以运行时 `useChat` 工具 part 为准微调）**

```typescript
import 'server-only'

export interface ApprovalDecisionInput {
    approvalId: string
    approved: boolean
    reason?: string
}

/**
 * 将 tool part 上 approval.id 匹配的项从 approval-requested 推进为下一状态；
 * 拒绝 → output-error，文案用 reason 或「用户未批准」。
 */
export function applyToolApprovalsToParts(parts: unknown[], approvals: ApprovalDecisionInput[]): unknown[] {
    const map = new Map(approvals.map(a => [a.approvalId, a]))
    return parts.map((p) => {
        if (typeof p !== 'object' || p === null)
            return p
        const part = p as Record<string, unknown>
        const approval = part.approval as { id?: string } | undefined
        const state = part.state as string | undefined
        if (!approval?.id || state !== 'approval-requested')
            return p
        const decision = map.get(approval.id)
        if (!decision)
            return p
        if (decision.approved) {
            return { ...part, state: 'input-available' }
        }
        return {
            ...part,
            state: 'output-error',
            errorText: decision.reason ?? '用户未批准',
        }
    })
}
```

- [ ] **Step 2：Commit**

```bash
git add lib/ai/tool-approval-parts.ts
git commit -m "feat(ai): apply tool approval decisions to message parts"
```

---

## Task 3：重构 `handleChatPost` 入口与构图

**Files:**

- Modify: [`app/api/chat/route.ts`](../../app/api/chat/route.ts)

- [ ] **Step 1：删除** `mergeClientMessagesWithDbForModel` 的 import 与 **`syncIncomingClientUserMessages` 在「整包 messages」路径下的用法**。

- [ ] **Step 2：`parsedBody` 成功后 `switch (parsedBody.data.kind)`**

**`user-turn`：**

1. `upsertUserMessageParts(db, conversationId, { id: parsed.data.messageId, parts: parsed.data.parts })`
2. `const rows = await listMessages(db, conversationId)`
3. `let uiMessages = dbRowsToUiMessagesForHydrate(rows)`
4. `uiMessages = await hydrateApiImageFilePartsForModel(db, conversationId, uiMessages)`
5. `runId = crypto.randomUUID()`（新 assistant 行）；`runningParts = []`；`runningUsage` 三字段清零

**`tool-approval`：**

1. `const row = await db.message.findUnique({ where: { id: parsed.data.assistantMessageId } })`；校验存在且 `conversationId` 匹配、`role === ASSISTANT`
2. `const pl = parseMessagePayload(row.payload)`；`const newParts = applyToolApprovalsToParts(pl.parts, parsed.data.approvals)`
3. `await upsertAssistantMessage(db, { id: row.id, conversationId, parts: newParts as object[], usage: pl.metadata?.usage ?? { inputTokens: null, outputTokens: null, totalTokens: null }, modelIdAtTime: pl.metadata?.modelIdAtTime ?? null })`
4. `rows = await listMessages(...)`；`uiMessages = hydrate(...)` 同上
5. `runId = parsed.data.assistantMessageId`；`runningParts = newParts as UIMessagePart[]`；`runningUsage` 从 `pl.metadata?.usage` 初始化（缺省按 0）

- [ ] **Step 3：将原 `continuingAssistant` / `lastClientMsg` 分支 **整体替换** 为上述 **`kind` 驱动** 逻辑（**不再\*\*读取 `clientMessagesOpt`）。

- [ ] **Step 4：`findUnique` 续写分支已有代码改为读 `payload`**

```typescript
const dbMsg = await db.message.findUnique({ where: { id: runId } })
const payload = dbMsg != null ? parseMessagePayload(dbMsg.payload) : null
runningParts = (payload?.parts as UIMessagePart[] | undefined) ?? []
runningUsage = {
    inputTokens: payload?.metadata?.usage?.inputTokens ?? 0,
    outputTokens: payload?.metadata?.usage?.outputTokens ?? 0,
    totalTokens: payload?.metadata?.usage?.totalTokens ?? 0,
}
```

（仅当 `tool-approval` 路径未在上面已设 `runningParts` 时保留；**避免重复**，以你在合流后的单一路径为准。）

---

## Task 4：外圈循环 + 去掉 `prepareStep`

**Files:**

- Modify: [`app/api/chat/route.ts`](../../app/api/chat/route.ts)、[`lib/ai/build-agent.ts`](../../lib/ai/build-agent.ts)（如需要）

- [ ] **Step 1：`buildAgent({ ... })` 删除 `prepareStep` 闭包**；**保留** `onStepFinish` 内 **upsertAssistantMessage**、image-fetch **持久化 user** 逻辑（与 SPEC §6「切段前落库」一致）。

- [ ] **Step 2：用 `createUIMessageStreamResponse` 包装 `createUIMessageStream`**，在 `execute` 内：

```typescript
// 伪代码骨架 — 以当前 route 变量为准接好类型
for (
    let extraUser: { id: string, role: 'user', parts: object[] } | undefined;
    ;
    extraUser = undefined
) {
    const base = extraUser ? [...uiMessagesForModel, extraUser] : uiMessagesForModel
    const validated = await validateUIMessages({ messages: base as never })
    const modelMessages = await convertToModelMessages(validated as never)

    const stream = await agent.stream({
        messages: modelMessages,
        // stopWhen: [stepCountIs(20), ({ steps }) => ...业务停止...]
    })
    writer.merge(stream.toUIMessageStream())
    await stream.consumeStream()

    // 根据本段 onStepFinish / toolCalls 决定是否构造 image-fetch 注入 user，赋给 extraUser 并继续循环；
    // 无则 break
}
```

- [ ] **Step 3：`generateMessageId: () => runId` 等行为挪到**与现 `route` 等价的 stream 选项\*\*（查阅 `createUIMessageStream` 的参数表，把原 `createAgentUIStreamResponse` 的 `messageMetadata` / `abortSignal` 对齐）。

- [ ] **Step 4：Commit**

```bash
git add app/api/chat/route.ts lib/ai/build-agent.ts
git commit -m "feat(api): DB-first chat route with outer generation loop"
```

---

## Task 5：更新集成测试请求体

**Files:**

- Modify: [`tests/api/chat/route.test.ts`](../../tests/api/chat/route.test.ts)

- [ ] **Step 1：将 `messages: [...]` 改为 `user-turn` 窄 body**

示例（原「两轮 user」测例）：

```typescript
            makeRequest({
                kind: 'user-turn',
                conversationId: conv.id,
                messageId: 'client-user-2',
                parts: [{ type: 'text', text: 'Second question' }],
            }),
```

- [ ] **Step 2：首轮仅需 DB 历史 + 新 user-turn 时，删除对 **整包 messages** 的依赖；若测例依赖「纯 POST 无 body user」路径，改为 **先 `appendUserMessage` + `kind: 'user-turn'`** 或 **仅 `conversationId` 旧行为** —— **本层已删除无 messages 的纯拉历史 POST** 时，必须显式 **`user-turn`** 触发；按 SPEC 与 Layer 03 schema，**不允许\*\*裸 `conversationId`。

若需「仅继写、无新 user 文本」的测试，使用 **`tool-approval`** 或单独的 **user-turn + `parts: []`**（Zod 当前要求 `parts` 数组存在，可为 `[]` —— 与 Layer 03 一致）。

- [ ] **Step 3：运行**

```bash
bun test tests/api/chat/route.test.ts
```

Expected: PASS

- [ ] **Step 4：Commit**

```bash
git add tests/api/chat/route.test.ts
git commit -m "test(api): chat route uses narrow POST body"
```

---

## Task 6：全量测试

```bash
bun test
bun run lint:fix
```

- [ ] **Step 1：Expected:** 全绿（Layer 05 前 **ChatPage 仍发旧 body** 时，**E2E/此仓库若有浏览器测** 可能红，故优先保证 **单测 + route**；若存在 `ChatPage` 集成测，可与 Layer 05 顺序合并或暂时跳过）。

---

## Spec 覆盖（Layer 04）

G1、G4、G5、G6；§5、§6、§7。

---

Plan complete. **Two execution options:**

**1. Subagent-Driven (recommended)** — `superpowers:subagent-driven-development`
**2. Inline Execution** — `superpowers:executing-plans`

Which approach?
