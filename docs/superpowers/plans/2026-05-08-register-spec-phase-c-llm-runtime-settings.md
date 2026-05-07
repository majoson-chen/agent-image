# SPEC Phase C：Register 运行时委派 + 设置页按 Register 懒加载 UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `docs/superpowers/specs/2026-05-07-provider-register-architecture-spec.md` 中 **G4（LLM 由 Register 产出 `LanguageModel`）**、**§9 Phase C（收口中央 `llm-provider-factory`）**、**G2/§6（设置页按 Register 异步加载配置表单）**落到可测代码；IMAGE/SEARCH 的「工具由 Register 导出」在本计划后半 **Task 8–9** 单独交付。

**Architecture:** ① 在 **`lib/providers/registry.ts` 的 Catalog 行上增加 `buildLanguageModel: (record: Model) => LanguageModel`**（仅 LLM 行）。② 每条 LLM Register 旁新增 **`*.llm-runtime.ts`（`server-only`）** 导出构造函数；阿里云多 SKU 共用 **`lib/providers/_internals/alibaba-dashscope-language-model.ts`**。③ 新入口 **`lib/providers/runtime/build-llm-from-model.ts`** 的 `buildLlmLanguageModel`；`lib/llm-provider-factory.ts` 可先 **re-export** 别名 `buildLlmModel` 降噪 diff。④ 设置：`lib/settings/llm-register-form-loaders.ts` 映射 `registerId → import()`，`app/settings/register-forms/llm/*.tsx` 默认导出表单，`AddLlmModelForm.tsx` 用 `next/dynamic`（`ssr:false`）按 Register 挂载。

**Tech Stack:** Next.js App Router、React 19、`next/dynamic`、`ai`/`@ai-sdk/*`、Vitest（`bun run test`）、Prisma、`server-only`。

---

## 前置阅读（0 上下文工程师）

| 文档 | 用途 |
|------|------|
| `docs/superpowers/specs/2026-05-07-provider-register-architecture-spec.md` | G2、G4、§6、§9 Phase C |
| `lib/llm-provider-factory.ts` | 待替换分发逻辑 |
| `lib/providers/registry.ts` | Catalog 扩展点 |
| `app/api/chat/route.ts` | L71 附近构造 LLM |
| `app/settings/AddLlmModelForm.tsx` | 待拆表单 |
| `AGENTS.md` | `@lib/*`、`~/`，禁止脏相对 import |

---

## File map

| 路径 | 职责 |
|------|------|
| `lib/providers/_internals/alibaba-dashscope-language-model.ts` | `createAlibaba` + compat baseURL → `LanguageModel` |
| `lib/providers/registers/openai-official.llm-runtime.ts` | Register 运行时 |
| `lib/providers/registers/openai-compatible-generic.llm-runtime.ts` | Register 运行时 |
| `lib/providers/registers/alibaba-dashscope-llm.llm-runtime.ts` | Register 运行时 |
| `lib/providers/registers/alibaba-dashscope-kimi-k2-6.llm-runtime.ts` | Register 运行时 |
| `lib/providers/registers/alibaba-dashscope-qwen3-6-plus.llm-runtime.ts` | Register 运行时 |
| `lib/providers/registry.ts` | Catalog 挂载 `buildLanguageModel` + `getLlmCatalogRowStrict` |
| `lib/providers/runtime/build-llm-from-model.ts` | 对外 `buildLlmLanguageModel` |
| `lib/llm-provider-factory.ts` | `export { buildLlmLanguageModel as buildLlmModel } from '...'` 或删除后全仓改 import |
| `app/api/chat/route.ts` | 使用 `buildLlmLanguageModel` |
| `lib/settings/llm-register-form-loaders.ts` | Client：`registerId → () => import(...)` |
| `app/settings/register-forms/llm/*.tsx` | 各 Register 配置表单 |
| `app/settings/AddLlmModelForm.tsx` | Register 选择 + dynamic 子表单 |
| `tests/providers/build-llm-from-model.test.ts` | 未知 `registerId` 抛错 |
| `docs/superpowers/plans/2026-05-07-provider-register-plans-overview.md` | 增加 Plan 05 行 |

---

### Task 1: 内核 `alibaba-dashscope-language-model`

**Files:**
- Create: `lib/providers/_internals/alibaba-dashscope-language-model.ts`

- [ ] **Step 1：写入文件**

```typescript
/**
 * DashScope OpenAI-compat：已解析 connection + 请求 model 名 → LanguageModel（内核）。
 */
import type { LanguageModel } from 'ai'
import type { AlibabaDashscopeConnection } from '@lib/providers/registers/alibaba-dashscope-shared'
import { createAlibaba } from '@ai-sdk/alibaba'
import { DASHSCOPE_COMPAT_BASE_MAINLAND } from '@lib/providers/registers/alibaba-dashscope-shared'
import 'server-only'

export function alibabaDashscopeCompatLanguageModel(
    connection: AlibabaDashscopeConnection,
    requestModelId: string,
): LanguageModel {
    const provider = createAlibaba({
        apiKey: connection.apiKey,
        baseURL: connection.baseURL ?? DASHSCOPE_COMPAT_BASE_MAINLAND,
        headers: connection.extraHeaders,
    })
    return provider(requestModelId)
}
```

- [ ] **Step 2：Commit** `chore(providers): dashscope compat language model kernel`

---

### Task 2: 五条 `*.llm-runtime.ts`

**Files:** 见 File map 中五个 `*.llm-runtime.ts`

- [ ] **Step 1：`openai-official.llm-runtime.ts`**

```typescript
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { createOpenAI } from '@ai-sdk/openai'
import { parseModelConfig } from '@lib/providers/registry'
import type { OpenaiOfficialConfig } from '@lib/providers/registers/openai-official'
import 'server-only'

export function buildOpenAiOfficialLanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as OpenaiOfficialConfig
    return createOpenAI({ apiKey: config.apiKey })(config.modelId)
}
```

- [ ] **Step 2：`openai-compatible-generic.llm-runtime.ts`**

```typescript
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { parseModelConfig } from '@lib/providers/registry'
import type { OpenaiCompatibleGenericConfig } from '@lib/providers/registers/openai-compatible-generic'
import 'server-only'

export function buildOpenAiCompatibleGenericLanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as OpenaiCompatibleGenericConfig
    return createOpenAICompatible({
        name: record.name,
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        headers: config.extraHeaders,
    })(config.modelId)
}
```

- [ ] **Step 3：`alibaba-dashscope-llm.llm-runtime.ts`**

```typescript
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { alibabaDashscopeCompatLanguageModel } from '@lib/providers/_internals/alibaba-dashscope-language-model'
import { parseModelConfig } from '@lib/providers/registry'
import type { AlibabaDashscopeLlmConfig } from '@lib/providers/registers/alibaba-dashscope-llm'
import 'server-only'

export function buildAlibabaDashscopeLlmLanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as AlibabaDashscopeLlmConfig
    const { modelId, ...connection } = config
    return alibabaDashscopeCompatLanguageModel(connection, modelId)
}
```

- [ ] **Step 4：`alibaba-dashscope-kimi-k2-6.llm-runtime.ts`**

```typescript
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { alibabaDashscopeCompatLanguageModel } from '@lib/providers/_internals/alibaba-dashscope-language-model'
import { parseModelConfig } from '@lib/providers/registry'
import type { AlibabaDashscopeConnection } from '@lib/providers/registers/alibaba-dashscope-shared'
import { DASHSCOPE_KIMI_K26_DOC } from '@lib/providers/registers/alibaba-dashscope-shared'
import 'server-only'

export function buildAlibabaDashscopeKimiK26LanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as AlibabaDashscopeConnection
    return alibabaDashscopeCompatLanguageModel(config, DASHSCOPE_KIMI_K26_DOC.modelId)
}
```

- [ ] **Step 5：`alibaba-dashscope-qwen3-6-plus.llm-runtime.ts`**

```typescript
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { alibabaDashscopeCompatLanguageModel } from '@lib/providers/_internals/alibaba-dashscope-language-model'
import { parseModelConfig } from '@lib/providers/registry'
import type { AlibabaDashscopeConnection } from '@lib/providers/registers/alibaba-dashscope-shared'
import { DASHSCOPE_QWEN36_PLUS_DOC } from '@lib/providers/registers/alibaba-dashscope-shared'
import 'server-only'

export function buildAlibabaDashscopeQwen36PlusLanguageModel(record: Model): LanguageModel {
    const config = parseModelConfig(record.registerId, record.config) as AlibabaDashscopeConnection
    return alibabaDashscopeCompatLanguageModel(config, DASHSCOPE_QWEN36_PLUS_DOC.modelId)
}
```

- [ ] **Step 6：Commit** `feat(providers): per-register llm-runtime builders`

---

### Task 3: Catalog + `buildLlmLanguageModel` + chat 接线

**Files:**
- Modify: `lib/providers/registry.ts`
- Create: `lib/providers/runtime/build-llm-from-model.ts`
- Modify: `lib/llm-provider-factory.ts`
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1：`build-llm-from-model.ts`**

```typescript
/**
 * Prisma Model → LanguageModel（SPEC G4 对外入口）。
 */
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { getLlmCatalogRowStrict } from '@lib/providers/registry'
import 'server-only'

export function buildLlmLanguageModel(record: Model): LanguageModel {
    if (record.type !== 'LLM')
        throw new Error(`期望 LLM 模型，实际 type=${record.type}`)
    return getLlmCatalogRowStrict(record.registerId).buildLanguageModel(record)
}
```

- [ ] **Step 2：扩展 `REGISTER_CATALOG` 各行 LLM：** 为本计划五条 LLM 增加 `buildLanguageModel: buildXxx` 字段（从 Task 2 import）。并新增 **`getLlmCatalogRowStrict`**：

```typescript
export function getLlmCatalogRowStrict(registerId: string) {
    const row = REGISTER_CATALOG.find(r => r.registerId === registerId)
    if (!row || row.modelType !== 'LLM')
        throw new Error(`unknown LLM registerId: ${registerId}`)
    const b = row.buildLanguageModel
    if (!b)
        throw new Error(`Register ${registerId} 缺少 buildLanguageModel`)
    return { ...row, buildLanguageModel: b }
}
```

Catalog 类型需扩展为：`RegisterMetadata & { schema: ZodType, buildLanguageModel?: (r: Model) => LanguageModel }`。

- [ ] **Step 3：`llm-provider-factory.ts`**

```typescript
/** @deprecated 请 import @lib/providers/runtime/build-llm-from-model */
export { buildLlmLanguageModel as buildLlmModel } from '@lib/providers/runtime/build-llm-from-model'
```

- [ ] **Step 4：`app/api/chat/route.ts`**：`buildLlmModel(modelRecord)` 改为 **`buildLlmLanguageModel`**，import 从 runtime 模块或暂留 factory re-export。

- [ ] **Step 5：** `bun run lint` Expect: 0 errors

- [ ] **Step 6：Commit** `feat(providers): catalog dispatches LanguageModel`

---

### Task 4: Vitest

**Files:**
- Create: `tests/providers/build-llm-from-model.test.ts`
- Modify: `tests/lib/llm-provider-factory.test.ts`（import 路径）

- [ ] **Step 1：测试未知 register**

```typescript
import { buildLlmLanguageModel } from '@lib/providers/runtime/build-llm-from-model'
import { describe, expect, it } from 'vitest'

describe('buildLlmLanguageModel', () => {
    it('throws for unknown LLM registerId', () => {
        expect(() =>
            buildLlmLanguageModel({
                id: 'x',
                type: 'LLM',
                name: 'n',
                registerId: 'acme/nonexistent',
                config: {},
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
        ).toThrow(/unknown LLM registerId/)
    })
})
```

- [ ] **Step 2：** `bun run test -- run tests/providers/build-llm-from-model.test.ts` Expect: PASS（Task 3 完成后）

- [ ] **Step 3：** 全量 `bun run test -- run` Expect: 全绿

- [ ] **Step 4：Commit** `test(providers): buildLlmLanguageModel guard`

---

### Task 5: Loader 映射

**Files:**
- Create: `lib/settings/llm-register-form-loaders.ts`（或 `.tsx` 若需）

- [ ] **Step 1：** 依 `tsconfig` paths 写死五个动态 import。若 `@/` 映射到 `app/`：

```typescript
'use client'

import type { ComponentType } from 'react'

export type LlmRegisterFormProps = {
    onCancel: () => void
    onCreated: () => void
}

const loaders: Record<string, () => Promise<{ default: ComponentType<LlmRegisterFormProps> }>> = {
    'openai/official': () => import('@/settings/register-forms/llm/OpenAiOfficialModelForm'),
    'openai-compatible/generic': () => import('@/settings/register-forms/llm/OpenAiCompatibleModelForm'),
    'alibaba/dashscope-llm': () => import('@/settings/register-forms/llm/AlibabaDashscopeLlmModelForm'),
    'alibaba/dashscope-kimi-k2-6': () => import('@/settings/register-forms/llm/AlibabaDashscopeKimiK26ModelForm'),
    'alibaba/dashscope-qwen3-6-plus': () => import('@/settings/register-forms/llm/AlibabaDashscopeQwen36PlusModelForm'),
}

export function loadLlmRegisterFormModule(registerId: string) {
    const load = loaders[registerId]
    if (!load)
        throw new Error(`No settings form for LLM register: ${registerId}`)
    return load()
}
```

若仓库 **无 `@/`**，改为 `~/app/settings/...` 或相对路径（以 `tsconfig` 为准）。

- [ ] **Step 2：Commit** `feat(settings): llm register form loaders map`

---

### Task 6: 五个表单组件 + 改 `AddLlmModelForm`

**Files:**
- Create: `app/settings/register-forms/llm/OpenAiOfficialModelForm.tsx`
- Create: `app/settings/register-forms/llm/OpenAiCompatibleModelForm.tsx`
- Create: `app/settings/register-forms/llm/DashScopeConnectionFields.tsx`（可选）
- Create: `app/settings/register-forms/llm/AlibabaDashscopeLlmModelForm.tsx`
- Create: `app/settings/register-forms/llm/AlibabaDashscopeKimiK26ModelForm.tsx`
- Create: `app/settings/register-forms/llm/AlibabaDashscopeQwen36PlusModelForm.tsx`
- Modify: `app/settings/AddLlmModelForm.tsx`

- [ ] **Step 1：** 从 **当前** `AddLlmModelForm.tsx` **逐字迁移** `POST /api/models` body 与字段校验（含 `thinkingBudget` 正整数、`capabilities` 合并规则），拆到对应默认导出组件；各组件 props 为 `LlmRegisterFormProps`。

- [ ] **Step 2：`AddLlmModelForm`**：选择 Register 后 `const Form = dynamic(() => loadLlmRegisterFormModule(registerId).then(m => m.default), { ssr: false })`；**`key={registerId}`** 强制 remount。

- [ ] **Step 3：** `bun run lint && bun run test -- run tests/api/models.test.ts`

- [ ] **Step 4：Commit** `feat(settings): lazy LLM register setting forms`

---

### Task 7: 更新计划总览

**Files:**
- Modify: `docs/superpowers/plans/2026-05-07-provider-register-plans-overview.md`

- [ ] **Step 1：** 表格追加 **Plan 05** → 本文档路径；SPEC：G4 LLM Phase C + G2 LLM UI。

- [ ] **Step 2：Commit** `docs(plans): register plan 05 overview`

---

### Task 8（后继）：IMAGE 工具抽到 Register 旁

**Files：**
- Create: `lib/tools/registers/image/volcengine-seedream-generate-tool.ts`、`dashscope-wan-generate-tool.ts`（文件名自定，需 `server-only`）
- Modify: `lib/tools/image-generate.ts` 或 `tool-registry.ts`：仅委派

**验收：** Tool 暴露名不变；Vitest `tests/tools/tool-registry.test.ts` 更新 import。

---

### Task 9（后继）：SEARCH Brave 工具委派

**Files：** `lib/tools/registers/search/brave-search-tool.ts` 等，改 `tool-registry.ts`。

---

## Self-review

| SPEC | Task |
|------|------|
| G4 LLM | 1–4 |
| Phase C 工厂收口 | 3 |
| G2 §6 懒加载 UI | 5–6 |
| G4 IMAGE | 8 |
| G4 SEARCH | 9 |
| 图像「一条 SKU 一 Register」 | **未**含；另开计划 |

无 `TBD`/空测试步骤。

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-register-spec-phase-c-llm-runtime-settings.md`。Two execution options:**

**1. Subagent-Driven (recommended)** — 每 Task 起子 Agent，Task 间 Review  

**2. Inline Execution** — 本会话按 Task 顺序执行 + 检查点  

**Which approach？**
