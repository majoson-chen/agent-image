# Layer 06：清理、整体验收与文档 / 画布

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除无引用旧代码；**将自动化测试与当前 SPEC / 实现对齐**（多轮需求后失败常来自 **过时单测**，不必默认先怀疑实现）；**默认**做到 **`bun test` + lint 全绿** + SPEC **§8** 人工验收 + **§9** 更新 **仓库根目录 `canvases/`** 中 `Message` / Agent 叙事。若短期内无法一次绿齐，可采用下方 **「收口策略（务实放宽）」**，以 **登记过的技术债** 换进度，避免无记录地砍测试或永久 skip。

**Architecture：**先 **Task 2 前置检索** 建立「测了啥 / 该测啥」清单，再对失败用例 **分类**（删 / 改 / 补 / 修实现）。**死代码**仍在 Task 1。**放宽不等于放任**：任何 skip、延期文件或放弃的单测须在 **PR 或 issue** 留痕；**额外检索**（`rg`、与 §8 对照）为必选项而非可选项。

**收口策略（务实放宽，Toy 可用）：**

- **分波次绿**：例如先 `tests/validation`、`tests/db`、`tests/prisma`，再 `tests/api/chat`、再 `tests/ai`；每波在 PR 写清范围，**避免**「只跑子集当完结」却无明示。
- **有登记的 skip**：允许对 **已分类** 为「待重写 / 依赖未稳定路由」的用例临时 `it.skip` 或拆到 `*.skip.test.ts`**，须附：**理由、owner、计划移除时间或 issue 编号**；**禁止\*\*无说明大面积 skip。
- **全红时先盘点后动手**：未完成 Task 2 检索表前，不要求猜测性改断言。

**Tech Stack：**`vitest`、`eslint`、仓库 `canvases/*.canvas.tsx`。

---

## 文件结构（本层）

| 动作        | 目标                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Delete?     | [`lib/ai/conversation-history-merge.ts`](../../lib/ai/conversation-history-merge.ts)                    |
| Modify      | [`tests/**`](../../tests) 中与 chat / Message / 旧 HTTP 契约相关的用例（**Task 2** 主导，可能删/改/增） |
| Modify      | **canvases** 中 Message 字段表                                                                          |
| 可选 Delete | [`app/api/chat/demo.ts`](../../app/api/chat/demo.ts)（若团队确认讨论稿可删）                            |

---

## Task 1：死代码清扫

- [ ] **Step 1：搜索 merge 入口**

```bash
rg "conversation-history-merge|mergeClientMessagesWithDbForModel" --glob '*.ts' --glob '*.tsx'
```

Expected：**无结果**后删除 [`lib/ai/conversation-history-merge.ts`](../../lib/ai/conversation-history-merge.ts)。

- [ ] **Step 2：搜索旧 POST body**

```bash
rg "messages:.*conversationId" app tests --glob '*.tsx'
```

Expected：**无**裸 `messages` 数组作为 chat POST 主契约（除 AI SDK 内部或注释）。

- [ ] **Step 3：Commit**

```bash
git rm lib/ai/conversation-history-merge.ts
git commit -m "chore: remove client-DB message merge helper"
```

---

## Task 2：测试套件与需求对齐（本层核心，多轮需求后必做）

> **背景：** Layer 01–05 合并后，**全量红或大量红** 可能是 **测试描述的是旧世界**（client-DB merge、旧 Prisma 列、旧 POST body），**不是**「实现一定全错」。本 Task 要求在改断言/删文件前有 **书面分类**（PR 描述或本分支 `notes` 几段即可）。

### Task 2a：检索与覆盖率检查（**先于**大面积改断言）

- [ ] **Step 1：与聊天 / Message / 旧契约相关的测试文件清单**

```bash
rg -l "handleChatPost|/api/chat|chatPostBody|mergeClientMessagesWithDbForModel|upsertAssistantMessage|listMessages" tests --glob '*.ts'
```

- [ ] **Step 2：是否仍存在「旧 Prisma / 旧 POST」痕迹（实现 + 测）**

```bash
rg "usageTotalTokens|Message\.content|\"content\":\s*\"" tests --glob '*.ts'
rg "messages:\s*\[\s*\{" tests tests/api --glob '*.ts' --glob '*.tsx'
```

对命中行 **逐条**判断：应删、应改为 `payload` / `user-turn`，还是误报（例如非 Message 的 `content`）。

- [ ] **Step 3：SPEC §8 与自动化的粗对照（表格写在 PR 或本节下方）**

| §8 场景            | 已有单测文件（无则写「缺」） |
| ------------------ | ---------------------------- |
| 多轮纯文本         |                              |
| 附件 + 刷新        |                              |
| 工具审批           |                              |
| image-fetch 多段   |                              |
| stop / 无 LLM 门闸 |                              |

**目的：**发现「测了很多旧行为」或「§8 完全无自动化」——再进入修复，避免只盯着当前失败栈顶。

### Task 2b：失败用例分类与修改

- [ ] **Step 1：收集失败列表（不假定单测名称仍正确）**

```bash
bun test 2>&1 | tee /tmp/agent-image-test.log
```

或分文件跑以定位：

```bash
bun test tests/prisma/ tests/db/ tests/api/ tests/ai/ tests/validation/ 2>&1
```

- [ ] **Step 2：对失败用例逐类（可多选）打标**

| 类别                           | 动作                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **A. 已废弃产品/架构**         | **删除**该 it / describe，或删掉整文件若全部作废；在 PR 写一句「原测 X 仅覆盖 Y，SPEC 已移除 Y」。           |
| **B. 行为仍要，断言/夹具过期** | **改写**：请求体改 `user-turn` / `tool-approval`；DB 断言改 `payload`；mock 与 `handleChatPost` 新分支对齐。 |
| **C. SPEC §8 要求但无单测**    | **新增**最小用例（仍遵守项目 TDD 习惯时，可 characterization 补测）。                                        |
| **D. 实现 bug**                | 修 `app/`、`lib/`，**不**用 `expect(true)` 糊测试。                                                          |

- [ ] **Step 3：高概率需人工过一遍的测试目录（按仓库现状勾选）**

- [`tests/api/chat/route.test.ts`](../../tests/api/chat/route.test.ts) — 旧 `messages` body、续写语义
- [`tests/api/chat-assistant-persistence.test.ts`](../../tests/api/chat-assistant-persistence.test.ts) — assistant / tool parts 落库
- 任意仍引用 `mergeClientMessagesWithDbForModel`、`Message.content`、`usageTotalTokens` 列断言的文件（`rg` 见 Task 1 旁路搜索）
- [`tests/prisma/schema.test.ts`](../../tests/prisma/schema.test.ts) — 已在 Layer 01 改过，若后续又漂移则在此收尾

- [ ] **Step 4：每处理完一批就提交**

```bash
git add tests/
git commit -m "test: realign chat/Message tests with DB-first spec"
```

（可按子目录拆多 commit。）

---

## Task 3：全量验证（在 Task 2 收敛后；可分波次，见上文收口策略）

- [ ] **Step 1：lint + 测试（优先全量；若采用分波次，逐项勾选并在 PR 声明「本轮仅保证子集」）**

```bash
bun run lint:fix
bun test
```

Expected：**默认** exit code 0。若仍有失败：

1. **回到 Task 2b** 继续分类；或
2. 采用 **有登记的** `it.skip`（写明理由 + issue），**不得**无说明静默跳过。

- [ ] **Step 2：Commit（若仅有 lockfile / 格式化）**

```bash
git add -A && git status
```

仅当有变更时 commit。

---

## Task 4：SPEC §8 验收场景（人工勾选）

**Files:**

- （只读）[`docs/superpowers/specs/2026-05-03-refactor-chat-db-first-narrow-body-spec.md`](../specs/2026-05-03-refactor-chat-db-first-narrow-body-spec.md) §8

- [ ] **Step 1：在 PR 描述或本地 checklist 逐项验证**

- 新会话首条 / 多轮纯文本 user
- 带 `/api/images/` 附件；刷新时间线
- 工具审批：通过 / 拒绝；DB 与 UI
- image-fetch 多段生成；刷新一致
- stop 中断；无 LLM 时门闸

- [ ] **Step 2：缺项则开 issue / 回滚至 Layer 04–05 修**

---

## Task 5：画布与数据模型叙述

- [ ] **Step 1：更新 [`canvases/数据模型.canvas.tsx`](../../canvases/数据模型.canvas.tsx)**
      将 `Message` 行从 `content` / `parts` / `usage*` / `modelIdAtTime` 改为 **`payload Json`** + 冗余 **`role`**（若保留）+ **`id` / `conversationId` / `createdAt`**。

- [ ] **Step 2：更新 [`canvases/Agent运行时与消息Parts.canvas.tsx`](../../canvases/Agent运行时与消息Parts.canvas.tsx)**
      将「客户端 messages 合并 DB」改为 **DB-first + 窄 POST**；指向 **Layer 05–transport**。

- [ ] **Step 3：Commit**

```bash
git add canvases/
git commit -m "docs(canvas): Message payload and DB-first chat flow"
```

---

## Task 6：Harness / RoadMap 状态（可选）

- [ ] **Step 1：在 [`2026-05-03-refactor-chat-db-first-roadmap.md`](./2026-05-03-refactor-chat-db-first-roadmap.md) §修订记录增加一行「六层 plan 已完成执行」——**仅当团队维护该文件时\*\*。

---

## Spec 覆盖（Layer 06）

§8、§9、§11 索引同步。

---

Plan complete. **Two execution options:**

**1. Subagent-Driven (recommended)** — `superpowers:subagent-driven-development`
**2. Inline Execution** — `superpowers:executing-plans`

Which approach?
