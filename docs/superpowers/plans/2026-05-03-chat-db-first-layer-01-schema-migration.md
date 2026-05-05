# Layer 01：Message 表 Schema + 迁移 + Prisma 表征测试

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `Message` 迁移为 SPEC §10 目标形态：**`id` + `conversationId` + `createdAt` + 冗余 `MessageRole role` + 必填 `payload Json`**；移除 `content`、`parts`、分列 `usage*`、`modelIdAtTime` 及 `Message → Model` 外键；用迁移 SQL **backfill** 旧行；仅修正 **直接操作 `prisma.message` 的测试**，**不**修改 [`lib/db/messages.ts`](../../lib/db/messages.ts)（属 Layer 02）。

**Architecture:** Toy 采用 **单次迁移**：`prisma migrate dev --create-only` 生成骨架后，用 **SQLite 重建表**（`PRAGMA foreign_keys` + `CREATE TABLE new_` + `INSERT...SELECT` + 重命名）完成 backfill 与删列，避免半成品 schema 让应用层编译通过。**冻结决策**：**保留表级 `role MessageRole`**（SPEC §10.2 可选冗余），与 `payload.role` 字符串在迁移中保持一致映射，Layer 02 负责写入时双写一致。

**Tech Stack:** Prisma 6、SQLite、`bun`、`vitest`、权威 SPEC [2026-05-03-refactor-chat-db-first-narrow-body-spec.md](../specs/2026-05-03-refactor-chat-db-first-narrow-body-spec.md)。

---

## 文件结构（本层）

| 文件                                                               | 职责                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [`prisma/schema.prisma`](../../prisma/schema.prisma)               | `Message` 模型定稿                                                                               |
| `prisma/migrations/<timestamp>_message_payload/migration.sql`      | backfill + 表重建                                                                                |
| [`tests/prisma/schema.test.ts`](../../tests/prisma/schema.test.ts) | 所有 `prisma.message` 用例改为新列；**SetNull** 语义改为「metadata 字符串不随删 Model 自动清空」 |
| [`prisma.config.ts`](../../prisma.config.ts)                       | 仅当 migrate 路径需说明时只读，一般不改                                                          |

---

## Task 1：冻结 `payload` JSON 形状（写入迁移与 Layer 02 共享）

**Files:**

- （无代码文件）在本文档与团队注释中一致使用下列形状。

- [ ] **Step 1：采纳下列 `payload` 形状（Layer 01 迁移 backfill 与 Layer 02 读写必须一致）**

```typescript
// 文档化用 TypeScript；SQLite 中存为 JSON 文本
interface MessagePayloadFrozen {
    role: 'user' | 'assistant' | 'system'
    parts: unknown[] // UIMessage.parts 同构 JSON 数组
    metadata?: {
        usage?: {
            inputTokens: number | null
            outputTokens: number | null
            totalTokens: number | null
        }
        modelIdAtTime?: string | null // 字符串，非 FK
    }
}
```

**Backfill 规则：**

- `payload.role`：`USER` → `'user'`，`ASSISTANT` → `'assistant'`，`SYSTEM` → `'system'`。
- `payload.parts`：若旧 `parts` 非 null，**原样**写入 JSON；否则 `[{ type: 'text', text: <content> }]`（`content` 为旧列字符串）。
- `payload.metadata.usage`：仅当 `usageTotalTokens` **非 null** 时写入三字段（缺失的 input/output 用 `null` 或 `0`，与现 [`lib/db/messages.ts`](../../lib/db/messages.ts) 行为保持一致：**用 `?? 0` 在应用层**，迁移里可用 `COALESCE(usageInputTokens,0)` 等）。
- `payload.metadata.modelIdAtTime`：旧 `modelIdAtTime` 列原样字符串复制（可为 null）。

- [ ] **Step 2：Commit**

```bash
git add docs/superpowers/plans/2026-05-03-chat-db-first-layer-01-schema-migration.md
git commit -m "docs(plan): layer 01 freeze Message payload shape"
```

---

## Task 2：修改 `schema.prisma` 中 `Message` 模型

**Files:**

- Modify: [`prisma/schema.prisma`](../../prisma/schema.prisma)（`model Message` 整段替换）

- [ ] **Step 1：将 `model Message` 替换为下列内容（`Model.messages` 关系删除）**

```prisma
model Message {
  id             String      @id @default(cuid())
  conversationId String
  /// 冗余枚举列，与 payload.role 同步（SPEC §10.2）；便于测试与粗筛
  role           MessageRole
  /// SPEC §10：UIMessage 对齐子集 JSON
  payload        Json
  createdAt      DateTime    @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2：从 `model Model` 中删除 `messages Message[]` 字段**

在 [`prisma/schema.prisma`](../../prisma/schema.prisma) 的 `model Model` 内删除一行：

```prisma
  messages        Message[]
```

- [ ] **Step 3：运行 format**

```bash
bun --bun run prisma format
```

Expected: 退出码 0。

- [ ] **Step 4：Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(prisma): Message payload JSON, drop Model FK from Message"
```

---

## Task 3：创建迁移（SQLite 重建 + backfill）

**Files:**

- Create: `prisma/migrations/YYYYMMDDHHMMSS_message_payload_json/migration.sql`（时间戳以 `prisma migrate dev --create-only` 为准）

- [ ] **Step 1：生成空迁移文件名**

```bash
bun --bun run prisma migrate dev --create-only --name message_payload_json
```

Expected: `prisma/migrations/<new>/migration.sql` 被创建（可能含 Prisma 自动草稿）。

- [ ] **Step 2：用下列 SQL 整体替换 `migration.sql` 内容**

> **说明：** SQLite 不支持单条 `DROP COLUMN` 多列随意组合时，**重建表**最稳。下列脚本假设 **迁移前** 表名仍为 `Message`、旧列仍存在（与当前仓库一致）。若 Prisma 生成的草稿已部分改表，**以本脚本为准覆盖全文件**。

```sql
-- Prisma SQLite: 重建 Message，backfill payload，去掉 content/parts/usage/FK
PRAGMA foreign_keys=OFF;

CREATE TABLE "Message_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_new_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Message_new" ("id", "conversationId", "role", "payload", "createdAt")
SELECT
    m."id",
    m."conversationId",
    m."role",
    json_patch(
        json_object(
            'role', CASE m."role"
                WHEN 'USER' THEN 'user'
                WHEN 'ASSISTANT' THEN 'assistant'
                WHEN 'SYSTEM' THEN 'system'
            END,
            'parts', COALESCE(
                m."parts",
                json_array(json_object('type', 'text', 'text', m."content"))
            )
        ),
        json_object(
            'metadata', json_object(
                'usage', CASE
                    WHEN m."usageTotalTokens" IS NOT NULL THEN json_object(
                        'inputTokens', COALESCE(m."usageInputTokens", 0),
                        'outputTokens', COALESCE(m."usageOutputTokens", 0),
                        'totalTokens', m."usageTotalTokens"
                    )
                END,
                'modelIdAtTime', m."modelIdAtTime"
            )
        )
    ),
    m."createdAt"
FROM "Message" AS m;

DROP TABLE "Message";
ALTER TABLE "Message_new" RENAME TO "Message";

CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");

PRAGMA foreign_keys=ON;
```

> **注意：** 若你机上的 SQLite `json_patch` / `COALESCE(m.parts, ...)` 与 **已存 `parts` 类型** 不兼容（极少见），将 `parts` 分支改为 `CASE WHEN m.parts IS NOT NULL THEN m.parts ELSE json_array(...) END`。

- [ ] **Step 3：对本地开发库应用迁移**

```bash
bun --bun run prisma migrate dev
```

Expected: 迁移应用成功；若 `data.db` 有旧数据应保留并被 backfill。

- [ ] **Step 4：生成 Client**

```bash
bun --bun run prisma generate
```

Expected: 退出码 0，`generated/prisma` 更新。

- [ ] **Step 5：Commit**

```bash
git add prisma/migrations/
git commit -m "feat(prisma): migrate Message to payload JSON with backfill"
```

---

## Task 4：更新 `tests/prisma/schema.test.ts`

**Files:**

- Modify: [`tests/prisma/schema.test.ts`](../../tests/prisma/schema.test.ts)

- [ ] **Step 1：在文件顶部 `describe` 外增加 payload 辅助函数（便于 DRY）**

```typescript
function userPayload(text: string) {
    return {
        role: 'user' as const,
        parts: [{ type: 'text', text }],
        metadata: {},
    }
}

function assistantPayload(text: string, metadata?: { usage?: { inputTokens: number, outputTokens: number, totalTokens: number }, modelIdAtTime?: string | null }) {
    return {
        role: 'assistant' as const,
        parts: [{ type: 'text', text }],
        metadata: metadata ?? {},
    }
}
```

- [ ] **Step 2：在 `describe('conversation + Message cascade')` 中，将两条 `prisma.message.create` 改为 `payload`**

第一处（用户消息）：

```typescript
await prisma.message.create({
    data: {
        conversationId: conv.id,
        role: 'USER',
        payload: userPayload('hello'),
    },
})
```

第二处（助手消息，带 usage 与 model 引用字符串）：

```typescript
await prisma.message.create({
    data: {
        conversationId: conv.id,
        role: 'ASSISTANT',
        payload: assistantPayload('hi', {
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 10 },
            modelIdAtTime: model.id,
        }),
    },
})
```

- [ ] **Step 3：替换 `sets modelIdAtTime to null when model is deleted` 用例**

原用例验证 **FK SetNull**。新 schema **无 FK**：改名为 `keeps payload metadata modelIdAtTime after model is deleted`，`model.delete` 后断言：

```typescript
const updated = await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })
const payload = updated.payload as { metadata?: { modelIdAtTime?: string | null } }
expect(payload.metadata?.modelIdAtTime).toBe(model.id)
```

（若希望与 SPEC「删 Model 仅清空引用」产品语义一致，可改为业务层 Layer 02 清理；**本层**仅表征 **DB 不会自动改 JSON**。）

- [ ] **Step 4：更新 `describe('message.parts column')`**

改名为 `describe('message.payload.parts')`，创建行改为：

```typescript
const parts = [
    { type: 'text', text: 'Hello' },
    { type: 'tool-web-search', state: 'output-available', toolCallId: 'tc1', input: { query: 'test' }, output: { items: [] } },
]
const msg = await prisma.message.create({
    data: {
        conversationId: conv.id,
        role: 'ASSISTANT',
        payload: { role: 'assistant', parts, metadata: {} },
    },
})
const found = await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })
const p = found.payload as { parts: unknown[] }
expect(p.parts).toEqual(parts)
```

`m1 legacy` 用例改为「payload.parts 仅 text、无 tool」或删除（已无 `parts` 列）；可改为：

```typescript
const msg = await prisma.message.create({
    data: {
        conversationId: conv.id,
        role: 'ASSISTANT',
        payload: { role: 'assistant', parts: [{ type: 'text', text: 'legacy' }], metadata: {} },
    },
})
const found = await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })
const p = found.payload as { parts: unknown[] }
expect(p.parts).toEqual([{ type: 'text', text: 'legacy' }])
```

- [ ] **Step 5：跑 Prisma 表征测试**

```bash
bun test tests/prisma/schema.test.ts
```

Expected: **全部通过**（Layer 02 未改前，**整个** `bun test` 可能仍因 `lib/db/messages` 引用旧字段失败，**本 Task 只保证此文件**）。

- [ ] **Step 6：Commit**

```bash
git add tests/prisma/schema.test.ts
git commit -m "test(prisma): align Message tests with payload JSON schema"
```

---

## Task 5：本层收口

- [ ] **Step 1：确认未误改应用层**

```bash
git diff --name-only
```

Expected: 不含 `lib/db/messages.ts`、`app/api/chat/route.ts`。

- [ ] **Step 2：在本分支 README 或 PR 描述中写一句：「合并 Layer 01 前预期全仓 test 红，直至 Layer 02」**

---

## Spec 覆盖（Layer 01）

| SPEC           | 本层                       |
| -------------- | -------------------------- |
| G7、§10、§10.5 | 表结构 + 去 FK + `payload` |

---

## 执行完成后

Plan complete. **Two execution options:**

**1. Subagent-Driven (recommended)** — `superpowers:subagent-driven-development`
**2. Inline Execution** — `superpowers:executing-plans`

Which approach?
