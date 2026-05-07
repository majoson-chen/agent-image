# Register Hook — Plan 01：Catalog 核心类型与 LLM 工厂收口

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入 **可 discriminated 的 `RegisterCatalogRow` 类型**，把现有 LLM `buildLanguageModel` **唯一挂载在 Catalog 行**上，并提供 **`getCatalogRow` / `getLlmCatalogRowStrict`** 的稳定入口，为后续 `image.*`、`search.*`、`llm.chatProviderOptions` 钩子腾出同一挂载点。

**Architecture:** 新建纯类型模块 `register-catalog-types.ts`；`registry.ts` 在构建 `REGISTER_CATALOG` 时，对 `modelType === 'LLM'` 的行从现有 `LLM_BUILD_LANGUAGE_MODEL_BY_REGISTER_ID` 表注入 `buildLanguageModel`（**行为与今完全一致**）。`register-config.ts` 保持仅 schema，避免与 runtime 循环依赖。

**Tech Stack:** TypeScript、`zod`、`ai`（`LanguageModel`）、Vitest、`bun run test`。

**前置阅读:** `docs/superpowers/plans/2026-05-08-register-kernel-decoupling-overview.md`、`docs/superpowers/specs/2026-05-08-register-hook-system-design.md` §4.2。

---

## 文件职责（本 plan 结束时）

| 路径 | 职责 |
| --- | --- |
| `lib/providers/register-catalog-types.ts`（新建） | `RegisterCatalogRow` discriminated union；注释标明 Hook 能力 ID |
| `lib/providers/registry.ts`（修改） | 构建 `REGISTER_CATALOG: readonly RegisterCatalogRow[]`；导出类型与 getter |
| `tests/providers/register-catalog.test.ts`（新建） | LLM 行必有工厂；未知 id 抛错 |

---

### Task 1: 类型模块与 discriminated union

**Files:**
- Create: `lib/providers/register-catalog-types.ts`
- Modify: `lib/providers/registry.ts`（下一步 Task 2 再接）

- [ ] **Step 1: 新建 `register-catalog-types.ts`**

```typescript
/**
 * Register Catalog 行类型（Hook SPEC：llm.languageModel 等）。
 * Kernel 仅依赖本模块与 registry 派发，不识别具体 registerId 列表。
 */
import type { LanguageModel } from 'ai'
import type { RegisterMetadata } from '@lib/providers/types'
import type { Model } from '~/generated/prisma/client'
import type { z } from 'zod'

export type RegisterCatalogRowBase = RegisterMetadata & {
    schema: z.ZodType<unknown>
}

/** Hook 能力 ID：llm.languageModel */
export type LlmRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'LLM'
    buildLanguageModel: (record: Model) => LanguageModel
}

export type ImageRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'IMAGE'
}

export type SearchRegisterCatalogRow = RegisterCatalogRowBase & {
    modelType: 'SEARCH'
}

export type RegisterCatalogRow =
    | LlmRegisterCatalogRow
    | ImageRegisterCatalogRow
    | SearchRegisterCatalogRow
```

- [ ] **Step 2: Commit**

```bash
git add lib/providers/register-catalog-types.ts
git commit -m "feat(providers): RegisterCatalogRow discriminated types"
```

---

### Task 2: `registry.ts` 接入 union 并保留行为

**Files:**
- Modify: `lib/providers/registry.ts`

- [ ] **Step 1: 将 `RegisterCatalogRow` 替换成从 `register-catalog-types` 导入；删除本地重复 interface。**

- [ ] **Step 2: 修正 `REGISTER_CATALOG` 的 map 回调返回类型**：`LLM` 分支返回 `LlmRegisterCatalogRow`（含 `buildLanguageModel`）；`IMAGE` / `SEARCH` 返回对应分支（当前无额外字段）。

- [ ] **Step 3: 运行全量测试**

Run: `cd /Users/majoson/CodeSpace/agent-image && bun run test -- run`

Expected: 全部 PASS（与改造前一致）。

- [ ] **Step 4: Commit**

```bash
git add lib/providers/registry.ts lib/providers/register-catalog-types.ts
git commit -m "refactor(providers): registry uses RegisterCatalogRow union"
```

---

### Task 3: 新增 catalog 行为测试（TDD 表征）

**Files:**
- Create: `tests/providers/register-catalog.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { getLlmCatalogRowStrict, listRegisterMetadata } from '@lib/providers/registry'
import { describe, expect, it } from 'vitest'

describe('Register catalog', () => {
    it('every LLM registerId has buildLanguageModel via getLlmCatalogRowStrict', () => {
        const llmIds = listRegisterMetadata('LLM').map(r => r.registerId)
        for (const id of llmIds) {
            const row = getLlmCatalogRowStrict(id)
            expect(row.buildLanguageModel).toBeTypeOf('function')
        }
    })

    it('getLlmCatalogRowStrict throws for IMAGE registerId', () => {
        expect(() => getLlmCatalogRowStrict('volcengine/seedream')).toThrow(/unknown LLM registerId/)
    })
})
```

- [ ] **Step 2: 运行测试**

Run: `bun run test -- run tests/providers/register-catalog.test.ts`

Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add tests/providers/register-catalog.test.ts
git commit -m "test(providers): catalog LLM rows expose buildLanguageModel"
```

---

### Task 4: 导出 `getCatalogRow`（可选但推荐）

**Files:**
- Modify: `lib/providers/registry.ts`

若后续 Plan 需要「任意 type 取行」，新增：

```typescript
export function getCatalogRow(registerId: string): RegisterCatalogRow | undefined {
    return REGISTER_CATALOG.find(r => r.registerId === registerId)
}
```

并在 `register-catalog.test.ts` 增加：`getCatalogRow('openai/official')?.modelType === 'LLM'`。

- [ ] **Step 1: 实现 + 测试 + Commit** `feat(providers): getCatalogRow helper`

---

## Plan 01 — Self-review

| Hook SPEC | Task |
| --- | --- |
| H2 Catalog 唯一索引 | Task 2–4 |
| G4 LLM LanguageModel | Task 2（已有，仅类型收口） |

**占位符扫描：** 无。

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-08 | 初版 |
