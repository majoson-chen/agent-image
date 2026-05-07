# Register Hook — Plan 03：IMAGE `image.tool` 与执行体迁出 Kernel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除 `lib/tools/image-generate.ts` 的 **`registerId` 分支**；移除 `lib/tools/tool-registry.ts` 中对 **`volcengine/seedream` / `dashscope/wan-image` 的白名单**；将 **`lib/image-provider-factory.ts`** 的 HTTP 与解析逻辑迁入 **各 IMAGE Register 模块**（或其在 `lib/providers/registers/` 下的子文件）；Kernel **仅**调用 Catalog 行上的 **`createImageGenerateTool`**（Hook SPEC **`image.tool`**）与可选 **`executeImageGeneration`**（**`image.execution`**，若与 tool 内联合并则文档注明「execution 私有」）。

**Architecture:** 扩展 `ImageRegisterCatalogRow`：`createImageGenerateTool: (opts: CreateImageGenerateToolOptions) => Tool`（类型取自 `lib/tools/registers/image/image-generate-tool-types.ts`）。`registry.ts` 对两行 IMAGE 注入从现有 `volcengine-seedream-generate-tool.ts` / `dashscope-wan-generate-tool.ts` **搬家后的工厂**。`executeImageGeneration` 迁入 `volcengine-seedream.execution.ts` 与 `dashscope-wan-image.execution.ts`（文件名可调整），`image-provider-factory.ts` **删除或变为 re-export 兼容层**。

**Tech Stack:** `ai` `tool()`、`zod`、Vitest。

**前置:** Plan 01；Plan 02 可与本 plan 并行不同分支，合并前解决 `registry.ts` 冲突。

---

## 文件职责

| 路径 | 职责 |
| --- | --- |
| `lib/providers/register-catalog-types.ts` | `ImageRegisterCatalogRow` 增加 `createImageGenerateTool` |
| `lib/providers/registry.ts` | 为 `volcengine/seedream`、`dashscope/wan-image` 注入工厂 |
| `lib/tools/image-generate.ts` | 改为 **单行派发**：`getImageCatalogRowStrict(registerId).createImageGenerateTool(opts)` |
| `lib/tools/tool-registry.ts` | 用 `getCatalogRow` + `modelType === 'IMAGE'` + `createImageGenerateTool` 替代白名单 |
| `lib/image-provider-factory.ts` | 删除或仅 re-export（过渡期 ≤1 个 commit） |
| `lib/providers/registers/*` | 迁入 execution HTTP |
| `tests/tools/image-generate.test.ts`、`*image-provider*` | 更新路径 |

---

### Task 1: 扩展类型与 `getImageCatalogRowStrict`

**Files:**
- Modify: `lib/providers/register-catalog-types.ts`
- Modify: `lib/providers/registry.ts`

- [ ] **Step 1:** 在 `ImageRegisterCatalogRow` 增加：

```typescript
import type { Tool } from 'ai'
import type { CreateImageGenerateToolOptions } from '@lib/tools/registers/image/image-generate-tool-types'

    /** Hook：image.tool */
    createImageGenerateTool: (opts: CreateImageGenerateToolOptions) => Tool
```

- [ ] **Step 2:** 在 `registry.ts` 导出：

```typescript
export function getImageCatalogRowStrict(registerId: string): ImageRegisterCatalogRow {
    const row = REGISTER_CATALOG.find(r => r.registerId === registerId)
    if (!row || row.modelType !== 'IMAGE')
        throw new Error(`unknown IMAGE registerId: ${registerId}`)
    return row
}
```

需从 `register-catalog-types` 导入 `ImageRegisterCatalogRow`。

- [ ] **Step 3: Commit** `feat(providers): ImageRegisterCatalogRow createImageGenerateTool`

---

### Task 2: 搬迁工厂并在 Catalog 注册（行为不变）

**Files:**
- Modify: `lib/providers/registry.ts`
- Modify: `lib/tools/registers/image/volcengine-seedream-generate-tool.ts`（或迁至 registers 目录后更新 import）
- Modify: `lib/tools/registers/image/dashscope-wan-generate-tool.ts`

- [ ] **Step 1:** 保持 `createVolcengineSeedreamImageGenerateTool` / `createDashscopeWanImageGenerateTool` 函数体不变，在 `registry.ts` 构建 IMAGE 行时：

```typescript
createImageGenerateTool: createVolcengineSeedreamImageGenerateTool, // for volcengine row
```

- [ ] **Step 2:** `lib/tools/image-generate.ts` 实现为：

```typescript
import type { CreateImageGenerateToolOptions } from '@lib/tools/registers/image/image-generate-tool-types'
import { getImageCatalogRowStrict } from '@lib/providers/registry'
import 'server-only'

export type { CreateImageGenerateToolOptions }

export function createImageGenerateTool(opts: CreateImageGenerateToolOptions) {
    const row = getImageCatalogRowStrict(opts.model.registerId)
    return row.createImageGenerateTool(opts)
}
```

- [ ] **Step 3:** 运行 `bun run test -- run tests/tools/image-generate.test.ts tests/image-provider-factory.test.ts`

Expected: PASS。

- [ ] **Step 4: Commit** `refactor(tools): image-generate dispatches via catalog only`

---

### Task 3: `tool-registry` 去白名单

**Files:**
- Modify: `lib/tools/tool-registry.ts`

- [ ] **Step 1:** 删除 `getImageRegisterConfig` 中对 `volcengine/seedream` / `dashscope/wan-image` 的显式判断；改为：

```typescript
function getImageRowOrThrow(model: Model) {
    if (model.type !== 'IMAGE')
        return null
    try {
        return getImageCatalogRowStrict(model.registerId)
    }
    catch {
        return null
    }
}
```

对 primary/secondary：若 `model` 存在且 `getImageRowOrThrow` 非空，则 `parseModelConfig(model.registerId, model.config)` 取 `supportedSizes`（类型断言与现网一致）。

- [ ] **Step 2:** `bun run test -- run tests/tools/tool-registry.test.ts`

- [ ] **Step 3: Commit** `refactor(tools): tool-registry image path uses catalog row`

---

### Task 4: 迁入 `executeImageGeneration` 至 Register 侧

**Files:**
- Create: `lib/providers/registers/volcengine-seedream.execution.ts`（或 `.../seedream/execute.ts`）
- Create: `lib/providers/registers/dashscope-wan-image.execution.ts`
- Modify: `lib/tools/registers/image/volcengine-seedream-generate-tool.ts` — import 新路径
- Modify: `lib/tools/registers/image/dashscope-wan-generate-tool.ts`
- Delete 或清空: `lib/image-provider-factory.ts`

- [ ] **Step 1:** 将 `executeSeedream`、`executeDashscopeWanImage` 及 helper 从 `image-provider-factory.ts` **剪切**至上述文件（保留 `import 'server-only'`）。

- [ ] **Step 2:** 在 `image-provider-factory.ts` 若需兼容旧 import，仅：

```typescript
export { executeImageGeneration } from '@lib/providers/registers/volcengine-seedream.execution'
// 实际应合并两个 register 的 export — 计划实施时用单一门面函数按 registerId 分发在 **Register 旁文件**，不在 Kernel
```

**实施要求：** 门面 `executeImageGeneration` 若仍存在，应位于 **`lib/providers/registers/image-execute.ts`**（新建），内部 **仅** `switch` + `parseModelConfig`，且该文件 **注释标明 DEPRECATED surface**，最终仅 tool 内部调用。

- [ ] **Step 3:** `bun run test -- run tests/image-provider-factory.test.ts`

- [ ] **Step 4: Commit** `refactor(providers): move image HTTP execution beside registers`

---

## Plan 03 — Self-review

| Hook SPEC | Task |
| --- | --- |
| image.tool | Task 1–2 |
| image.execution | Task 4 |
| H2 | Task 2–3 |

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-08 | 初版 |
