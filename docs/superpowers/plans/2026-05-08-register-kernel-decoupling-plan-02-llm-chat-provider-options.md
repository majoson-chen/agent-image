# Register Hook — Plan 02：LLM `computeLlmChatProviderOptions` 收口至 Catalog

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 `lib/llm-chat-provider-options.ts` 中的 **`DASHSCOPE_LLM_REGISTER_IDS` / `DASHSCOPE_THINKING_SKU_IDS`**；在 **`LlmRegisterCatalogRow` 上挂载可选钩子 `computeLlmChatProviderOptions`**（对应 Hook SPEC **`llm.chatProviderOptions`**）；`app/api/chat/route.ts` **仅从 Catalog 行**取 options。

**Architecture:** 将现有 `computeLlmChatProviderOptions`、`dashScopeThinkingEnabledFromConfig`、`llmSupportsThinking` 的 **算法** 迁到 `lib/providers/registers/` 下 **按 SKU 或共享模块** 的文件中；`registry.ts` 在组装 LLM 行时 **注入函数指针**。OpenAI 类 Register **不提供钩子**（恒 `undefined`）。

**Tech Stack:** `@ai-sdk/provider-utils`（`ProviderOptions`）、`ai`、`vitest`。

**前置:** [Plan 01](./2026-05-08-register-kernel-decoupling-plan-01-catalog-hooks-core.md) 已合并。

---

## 文件职责

| 路径 | 职责 |
| --- | --- |
| `lib/providers/register-catalog-types.ts` | `LlmRegisterCatalogRow` 增加可选 `computeLlmChatProviderOptions?` |
| `lib/providers/registers/alibaba-dashscope-chat-options.ts`（新建） | 纯函数：`thinkingEnabledFromConfig`、`computeProviderOptions`（从现有文件剪切） |
| `lib/providers/registry.ts` | 对五条 LLM 行注入钩子（仅 Alibaba 行非空） |
| `lib/llm-chat-provider-options.ts` | 变薄：重导出 `llmSupportsThinking` 等供 UI，**内部转发 Catalog**（或 UI 直接调新模块） |
| `app/api/chat/route.ts` | `computeLlmChatProviderOptions` 改为 `getLlmCatalogRowStrict(id).computeLlmChatProviderOptions?.(model)` |
| `tests/lib/llm-chat-provider-options.test.ts` | 更新 import 与断言对象；行为不变 |

---

### Task 1: 扩展类型

**Files:**
- Modify: `lib/providers/register-catalog-types.ts`

- [ ] **Step 1: 增加 import 与可选字段**

```typescript
import type { ProviderOptions } from '@ai-sdk/provider-utils'
```

在 `LlmRegisterCatalogRow` 内增加：

```typescript
    /** Hook 能力 ID：llm.chatProviderOptions — 缺省表示不注入 */
    computeLlmChatProviderOptions?: (record: Model) => ProviderOptions | undefined
```

（`Model` 需已从 `~/generated/prisma/client` 导入。）

- [ ] **Step 2: Commit** `feat(providers): LlmRegisterCatalogRow chatProviderOptions hook type`

---

### Task 2: 抽出 Alibaba 计算逻辑到新模块

**Files:**
- Create: `lib/providers/registers/alibaba-dashscope-chat-options.ts`

- [ ] **Step 1: 从 `lib/llm-chat-provider-options.ts` 剪切** `dashScopeThinkingEnabledFromConfig`、`dashScopeThinkingSkuRegisterId`、`parseDashScopeConfig` 等价逻辑至新文件；导出：

```typescript
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { Model } from '~/generated/prisma/client'
import { parseModelConfig } from '@lib/providers/register-config'

// ... move implementations; export:

export function computeAlibabaDashscopeChatProviderOptions(model: Model): ProviderOptions | undefined
export function llmSupportsThinking(meta: Pick<Model, 'registerId' | 'config'>): boolean
```

实现规则：**逐字保持**现有 `computeLlmChatProviderOptions` 与 `llmSupportsThinking` 的布尔与合并逻辑（含 `parallelToolCalls`、`thinkingBudget`）。

- [ ] **Step 2: 运行现有测试（未改 route 前可能仍通过）**

Run: `bun run test -- run tests/lib/llm-chat-provider-options.test.ts`

- [ ] **Step 3: Commit** `refactor(providers): extract DashScope chat options helpers`

---

### Task 3: `registry.ts` 注入钩子

**Files:**
- Modify: `lib/providers/registry.ts`

- [ ] **Step 1:** 在构建 `REGISTER_CATALOG` 的 LLM 分支，对 `registerId` 为下列之一时设置  
  `computeLlmChatProviderOptions: computeAlibabaDashscopeChatProviderOptions`  
  （若 Step 2 拆成 **按 SKU 不同默认**，则改为五个独立函数并在 import 区区分；**行为须与现网一致**。）

当前仓库中 **需要 Alibaba ProviderOptions 的 registerId**（以现有 `llm-chat-provider-options.ts` 为准）：

- `alibaba/dashscope-llm`
- `alibaba/dashscope-kimi-k2-6`
- `alibaba/dashscope-qwen3-6-plus`

三者共用一个函数即可（函数内部已读 `model.registerId`）。

`openai/official` 与 `openai-compatible/generic`：**不设置**钩子字段。

- [ ] **Step 2: Commit** `feat(providers): wire computeLlmChatProviderOptions on LLM catalog rows`

---

### Task 4: Chat route 与薄封装

**Files:**
- Modify: `app/api/chat/route.ts`
- Modify: `lib/llm-chat-provider-options.ts`

- [ ] **Step 1: 新增 Kernel 级导出函数（供 route 单点调用）**

在 `lib/llm-chat-provider-options.ts` 顶部改为：

```typescript
import type { Model } from '~/generated/prisma/client'
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import { getLlmCatalogRowStrict } from '@lib/providers/registry'

export function computeLlmChatProviderOptions(model: Model): ProviderOptions | undefined {
    const row = getLlmCatalogRowStrict(model.registerId)
    return row.computeLlmChatProviderOptions?.(model)
}
```

并 **re-export** `llmSupportsThinking`、`dashScopeThinkingSkuRegisterId` 等 UI 函数（从新模块 `alibaba-dashscope-chat-options.ts` 导出）。

- [ ] **Step 2: 删除**原文件中的 `DASHSCOPE_*` `Set` 与重复实现块。

- [ ] **Step 3: 运行测试**

Run: `bun run test -- run tests/lib/llm-chat-provider-options.test.ts app/api/chat/route.ts`

使用：`bun run test -- run`

Expected: 全部 PASS。

- [ ] **Step 4: Commit** `refactor(chat): providerOptions from catalog hook only`

---

### Task 5: UI 引用路径确认

**Files:**
- Grep: `llmSupportsThinking`、`DashScopeConnectionFields`

- [ ] **Step 1:** 确保 `app/settings/register-forms/llm/*.tsx` 仍从 `@lib/llm-chat-provider-options` 导入；若改为直连 `alibaba-dashscope-chat-options.ts`，须统一一处并跑 `bun run test`。

---

## Plan 02 — Self-review

| 条款 | Task |
| --- | --- |
| Hook SPEC H2（Kernel 无名单） | Task 2–4 |
| G4 LLM | Task 3–4 |

**占位符：** 无。

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-08 | 初版 |
