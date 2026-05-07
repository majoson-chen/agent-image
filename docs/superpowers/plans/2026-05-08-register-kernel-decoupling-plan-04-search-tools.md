# Register Hook — Plan 04：SEARCH `search.tools` 收口

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `lib/tools/tool-registry.ts` **不再**出现 `parseModelConfig('brave/search', ...)` 字面量与 **`BraveSearchConfig` 直连 brave-search-tools** 的硬编码组合；改为从 **`SearchRegisterCatalogRow`** 上的 **`buildSearchToolsForModel`**（Hook SPEC **`search.tools`**）取得 `{ webSearch: Tool, imageSearch: Tool }`。

**Architecture:** 扩展 `SearchRegisterCatalogRow`，增加：

```typescript
buildSearchToolsForModel: (model: Model) => { webSearch: Tool; imageSearch: Tool }
```

当前仅 **`brave/search`** 一种 SEARCH Register：实现委托现有 `lib/tools/registers/search/brave-search-tools.ts`（Brave URL 留在该文件内，**视为 brave Register 实现细节**）。`tool-registry` 仅：`const tools = row.buildSearchToolsForModel(model)`。

**Tech Stack:** `ai` `Tool`、`vitest`。

**前置:** Plan 01。

---

## 文件职责

| 路径 | 职责 |
| --- | --- |
| `lib/providers/register-catalog-types.ts` | `SearchRegisterCatalogRow` 增加 `buildSearchToolsForModel` |
| `lib/providers/registry.ts` | 为 `brave/search` 行注入实现 |
| `lib/tools/tool-registry.ts` | 绑定 WEB_SEARCH / IMAGE_SEARCH 时调用钩子 |
| `lib/tools/registers/search/brave-search-tools.ts` | 保持实现；可被 `registry` 旁新建 `brave-search.catalog-bindings.ts` 包装 |

---

### Task 1: 类型与 `getSearchCatalogRowStrict`

**Files:**
- Modify: `lib/providers/register-catalog-types.ts`
- Modify: `lib/providers/registry.ts`

- [ ] **Step 1:** 为 `SearchRegisterCatalogRow` 增加：

```typescript
import type { Tool } from 'ai'
import type { Model } from '~/generated/prisma/client'

    /** Hook：search.tools — 绑定行的 Model 须 type===SEARCH 且 registerId 与本行一致 */
    buildSearchToolsForModel: (model: Model) => { webSearch: Tool; imageSearch: Tool }
```

- [ ] **Step 2:** `registry.ts` 导出 `getSearchCatalogRowStrict(registerId: string)`（镜像 `getImageCatalogRowStrict`）。

- [ ] **Step 3: Commit** `feat(providers): SearchRegisterCatalogRow buildSearchToolsForModel`

---

### Task 2: Brave 绑定工厂

**Files:**
- Create: `lib/providers/registers/brave-search.tools-from-model.ts`

```typescript
/**
 * brave/search：由 Model 行构造 web / image 搜索工具（Kernel 零 Brave 字面量）。
 */
import type { Model } from '~/generated/prisma/client'
import type { Tool } from 'ai'
import { parseModelConfig } from '@lib/providers/register-config'
import type { BraveSearchConfig } from '@lib/providers/registers/brave-search'
import { createBraveImageSearchTool, createBraveWebSearchTool } from '@lib/tools/registers/search/brave-search-tools'
import 'server-only'

export function buildBraveSearchToolsForModel(model: Model): { webSearch: Tool; imageSearch: Tool } {
    if (model.type !== 'SEARCH' || model.registerId !== 'brave/search')
        throw new Error(`expected brave/search SEARCH model, got ${model.registerId}`)
    const config = parseModelConfig(model.registerId, model.config) as BraveSearchConfig
    const key = config.apiKey
    return {
        webSearch: createBraveWebSearchTool(key),
        imageSearch: createBraveImageSearchTool(key),
    }
}
```

- [ ] **Step 1:** 将上述文件加入仓库；在 `registry.ts` 的 SEARCH 行设置  
  `buildSearchToolsForModel: buildBraveSearchToolsForModel`。

- [ ] **Step 2: Commit** `feat(providers): brave/search search.tools hook implementation`

---

### Task 3: 改写 `tool-registry.ts`

**Files:**
- Modify: `lib/tools/tool-registry.ts`

- [ ] **Step 1:** 删除 `getBraveApiKey`；替换为：

```typescript
import { getSearchCatalogRowStrict } from '@lib/providers/registry'

// inside WEB_SEARCH branch after getModel:
const searchRow = getSearchCatalogRowStrict(model.registerId)
const { webSearch } = searchRow.buildSearchToolsForModel(model)
tools['web-search'] = webSearch
```

对 IMAGE_SEARCH 同理使用 `imageSearch`。

- [ ] **Step 2:** `bun run test -- run tests/tools/tool-registry.test.ts`

- [ ] **Step 3: Commit** `refactor(tools): tool-registry search uses catalog hook`

---

## Plan 04 — Self-review

| Hook SPEC search.tools | Task 2–3 |
| H2 | Task 3 |

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-08 | 初版 |
