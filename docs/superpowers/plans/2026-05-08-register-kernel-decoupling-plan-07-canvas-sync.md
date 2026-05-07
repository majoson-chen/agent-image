# Register / Kernel 解耦 — Plan 07：Canvas 人类文档同步

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 更新仓库 **本地画布** `canvases/*.canvas.tsx`，使叙述与 **Hook 系统**、**Catalog 派发**、**chat route 无厂商分支** 一致；避免人类读者按旧图（`buildLlmModel` 三分支、`computeLlmChatProviderOptions(model, params)`）误解。

**Architecture:** 只改 **文案与表格行**；**不**改应用路由与业务逻辑。引用文档：`docs/superpowers/specs/2026-05-08-register-hook-system-design.md`、`docs/guides/register-system.md`。

**Tech Stack:** React canvas 组件（`cursor/canvas`）、Markdown 风格段落。

**前置:** Plan 02–04 **至少已在主干合并**（否则画布描述 Hook 会超前）；或与实施者约定画布 **标注「目标态」**。

---

## 涉及画布（当前仓库）

| 文件 | 预期修改 |
| --- | --- |
| `canvases/Provider工厂.canvas.tsx` | LLM：Catalog `buildLanguageModel` + 可选 `computeLlmChatProviderOptions`；删除「三分支 factory」表述；IMAGE：Catalog `createImageGenerateTool` / Register 侧 execution |
| `canvases/架构总览.canvas.tsx` | API 列表旁注「tool-registry 经 Catalog hook」 |
| `canvases/Agent运行时与消息Parts.canvas.tsx` | `providerOptions` 来源改为 **Catalog 钩子** |
| `canvases/数据模型.canvas.tsx`（若存在 Register 段落） | `registerId` + config；指向 `docs/guides/register-system.md` |

---

### Task 1: 阅读 Skill 与现有画布

**Files:**
- Read: `/Users/majoson/.cursor/skills-cursor/canvas/SKILL.md`（Canvas 编辑约定）
- Read: `canvases/Provider工厂.canvas.tsx`（全文）

- [ ] **Step 1:** 标注待替换句子清单（贴 PR）。

---

### Task 2: 修改 `Provider工厂.canvas.tsx`

**Files:**
- Modify: `canvases/Provider工厂.canvas.tsx`

- [ ] **Step 1:** 将「LLM 工厂链」表改为：

- **入口：** `lib/providers/runtime/build-llm-from-model.ts` → `getLlmCatalogRowStrict` → **`buildLanguageModel`（Catalog 行钩子）**
- **ProviderOptions：** `computeLlmChatProviderOptions` **来自 Catalog 行** `computeLlmChatProviderOptions`（非 Kernel 内_SET）

- [ ] **Step 2:** 将图像段落指向：**`createImageGenerateTool` → Catalog `createImageGenerateTool`**；HTTP 在 Register 侧 execution。

- [ ] **Step 3: Commit** `docs(canvas): Provider factory aligns with Register hooks`

---

### Task 3: 修改 `架构总览.canvas.tsx` 与 `Agent运行时与消息Parts.canvas.tsx`

**Files:**
- Modify: `canvases/架构总览.canvas.tsx`
- Modify: `canvases/Agent运行时与消息Parts.canvas.tsx`

- [ ] **Step 1:** 替换「computeLlmChatProviderOptions(model, params)」为 **`computeLlmChatProviderOptions(model)`** 且注明 **Catalog 钩子**。

- [ ] **Step 2: Commit** `docs(canvas): runtime canvases reflect hook-based providerOptions`

---

### Task 4: `数据模型.canvas.tsx`（可选）

**Files:**
- Modify: `canvases/数据模型.canvas.tsx`（若存在）

- [ ] **Step 1:** 增加一句：**Kernel 不持有厂商枚举；SKU 列表仅以 Catalog 为真源**。

---

### Task 5: 自检

- [ ] **Step 1:** `bun run test -- run`（画布 TSX 若参与 typecheck）

- [ ] **Step 2:** 目视打开 Cursor Canvas（若环境可用）

---

## Plan 07 — Self-review

| 用户规则 Canvas 同步 | Task 1–5 |
| --- | --- |

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-08 | 初版 |
