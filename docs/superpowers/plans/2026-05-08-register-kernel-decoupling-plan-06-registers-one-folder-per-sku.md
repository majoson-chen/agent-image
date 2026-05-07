# Register Hook — Plan 06：`lib/providers/registers/` 一户一地目录迁移

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `lib/providers/registers/` 根目录散装的 **`*.ts` + `*.llm-runtime.ts`** 收敛为 **每户独立目录**（`registerId` slug），入口 **`index.ts`**（或 `schema.ts` + `runtime.server.ts`），满足 [`register-as-plugin-qualitative-standard`](../../specs/2026-05-08-register-as-plugin-qualitative-standard.md) §4。

**Architecture:** 每个 SKU 目录导出 **与今日相同的 Zod schema 名**（避免波及 `register-config.ts` import 大面积改写）；推荐目录名：将 `alibaba/dashscope-kimi-k2-6` 映射为 **`alibaba-dashscope-kimi-k2-6/`**（与现有文件名一致）。LLM runtime 文件迁入同目录并改名 **`llm-runtime.server.ts`**（内容 `'server-only'`），由 **`index.ts` re-export** schema + runtime 模块路径供 `registry.ts` 更新 import。

**Tech Stack:** TypeScript path `@lib/providers/registers/...`、Vitest。

**前置:** Plan 01–05 **若在主干**：本 plan 易产生冲突；建议在 **独立分支** 执行或在 Plan 05 合并后再做。

**风险:** 任何 **client 组件** 若误 import 含 `server-only` 的文件会构建失败；迁后须 `bun run build` 或 `next build` 验证（见 Task 3）。

---

## 目标目录示例（与当前文件对应）

| 当前文件 | 迁后路径 |
| --- | --- |
| `openai-official.ts` | `openai-official/index.ts`（仅 re-export 原内容） |
| `openai-official.llm-runtime.ts` | `openai-official/llm-runtime.server.ts` |
| `alibaba-dashscope-kimi-k2-6.ts` | `alibaba-dashscope-kimi-k2-6/index.ts` |
| `alibaba-dashscope-kimi-k2-6.llm-runtime.ts` | `alibaba-dashscope-kimi-k2-6/llm-runtime.server.ts` |

其余 SKU **同理**；`alibaba-dashscope-shared.ts` 可保留根目录 **单文件**（共享包）或迁入 `_shared/` — **任选其一**，全仓库统一。

---

### Task 1: 盘点 import

**Files:**
- Shell only

- [ ] **Step 1:**

```bash
rg "from '@lib/providers/registers/" /Users/majoson/CodeSpace/agent-image --glob '*.{ts,tsx}'
```

保存输出为迁移对照表（粘贴到 PR 描述）。

---

### Task 2: 单个 SKU 试点（OpenAI official）

**Files:**
- Move: `openai-official.ts` → `openai-official/schema.ts`（或单文件 `index.ts` 复制内容）
- Move: `openai-official.llm-runtime.ts` → `openai-official/llm-runtime.server.ts`

- [ ] **Step 1:** 创建目录 `lib/providers/registers/openai-official/`，放入文件，`index.ts`:

```typescript
export * from './schema'
```

若 schema 文件名为原 `openai-official.ts` 内容，则 `schema.ts` export `openaiOfficialConfigSchema`。

- [ ] **Step 2:** 更新 `lib/providers/register-config.ts` import：

```typescript
import { openaiOfficialConfigSchema } from '@lib/providers/registers/openai-official'
```

（路径指向目录 `index.ts`，无需 `/index`。）

- [ ] **Step 3:** 更新 `lib/providers/registry.ts` import：

```typescript
import { buildOpenAiOfficialLanguageModel } from '@lib/providers/registers/openai-official/llm-runtime.server'
```

- [ ] **Step 4:** `bun run test -- run`

Expected: PASS。

- [ ] **Step 5: Commit** `refactor(registers): openai-official one-folder layout`

---

### Task 3: 批量迁移其余 SKU

**Files:**
- Repeat Task 2 pattern for each remaining register file。

- [ ] **Step 1:** 每迁完 2–3 个 SKU commit 一次，避免单 PR 过大。

- [ ] **Step 2:** 删除 **空**旧文件路径。

- [ ] **Step 3:** 运行：

```bash
cd /Users/majoson/CodeSpace/agent-image && bun run test -- run && bun run build
```

Expected: test PASS；build 无 client import `server-only` 错误。

---

### Task 4: 文档一句

**Files:**
- Modify: `docs/guides/register-system.md` §7 锚点表 — 更新「Register 源码目录」描述为 **一户一地已完成**。

- [ ] **Step 1: Commit** `docs(guides): registers directory layout updated`

---

## Plan 06 — Self-review

| 插件定性 §4 | Task 2–3 |
| --- | --- |

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-08 | 初版 |
