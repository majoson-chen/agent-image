# Provider Register — Plan 03：设置页 API 与懒加载配置 UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 满足 SPEC **G2**：三区（LLM / IMAGE / Search）各自 **仅展示同 `modelType` 的 Register**；用户选定 Register 后 **懒加载** 对应配置表单；提交走 **统一 Models API**（`registerId` + `name` + `config`）；编辑时 **预填** `parseModelConfig` 后的默认值。

**Architecture:** 新增只读 API `GET /api/register-metadata?type=LLM|IMAGE|SEARCH` 返回 `listRegisterMetadata` 的 JSON；配置表单为 **Client Component**，按 `registerId` `dynamic()` 分包；表单提交 **不** 把明文密钥写进 URL。删除旧 `Add*ModelForm` 中 `providerType` 分叉 UI。

**Tech Stack:** Next.js App Router、`react`、daisyUI（须读 `docs/design-language.md` + `.cursor/rules/daisyui.mdc`）、`skeleton` Suspense、`zod`、`vitest` + `@testing-library/react`（表单测）

**前置:** Plan 01（DB + `createModel`）与 Plan 02（端到端可先部分手测）已完成。

---

## 文件结构

| 路径 | 职责 |
| --- | --- |
| `app/api/register-metadata/route.ts` | GET；query `type`；返回 `RegisterMetadata[]` |
| `app/api/models/route.ts` | POST body **仅** `modelCreateBodySchema`（Plan 01）；PATCH/PUT 如需 |
| `app/settings/RegisterPickerModal.tsx` | `'use client'`：下拉/列表选 `registerId` → `dynamic` 加载表单 |
| `app/settings/forms/llm/OpenaiOfficialForm.tsx` | 示例：字段 `modelId`、`apiKey`；提交父级 `onSubmit(config)` |
| ... | 每种 Register 对应 `forms/<group>/<RegisterId.slug>.tsx`（路径自行约定，避免非法 `/`） |
| `app/settings/AddLlmModelForm.tsx` 等 | **重写**：改为嵌入式 `RegisterPickerModal` |
| `tests/api/register-metadata.test.ts` | Route handler 单元测（导出 `handleRegisterMetadataGet`） |

**命名建议：** 文件前缀映射 `registerId`：`openai-official.tsx` ⇄ `'openai/official'`（建立 `REGISTER_ID_TO_FORM` 映射表）。

---

### Task 1: `GET /api/register-metadata`

**Files:**

- Create: `app/api/register-metadata/route.ts`
- Create: `tests/api/register-metadata.test.ts`

- [ ] **Step 1: 测试 RED**

```typescript
import { handleRegisterMetadataGet } from '~/app/api/register-metadata/route'
import { describe, expect, it } from 'vitest'

describe('register-metadata GET', () => {
    it('returns LLM registers only', async () => {
        const params = new URLSearchParams({ type: 'LLM' })
        const res = await handleRegisterMetadataGet(params)
        expect(res.status).toBe(200)
        const body = await res.json() as Array<{ registerId: string, modelType: string }>
        expect(body.every(x => x.modelType === 'LLM')).toBe(true)
        expect(body.some(x => x.registerId === 'openai/official')).toBe(true)
        expect(body.some(x => x.registerId === 'brave/search')).toBe(false)
    })
})
```

需将 **handler** 从 route 导出（与 `app/api/models/route.ts` 的 `handleModelsGet` 模式一致）。

- [ ] **Step 2: 实现**

`app/api/register-metadata/route.ts`:

```typescript
import { listRegisterMetadata } from '@lib/providers/registry'
import { NextResponse } from 'next/server'

/** 可被 Route 与 Vitest 直接调用 */
export async function handleRegisterMetadataGet(searchParams: URLSearchParams) {
    const t = searchParams.get('type')
    if (t !== 'LLM' && t !== 'IMAGE' && t !== 'SEARCH')
        return NextResponse.json({ error: 'type 必须为 LLM | IMAGE | SEARCH' }, { status: 400 })
    const list = listRegisterMetadata(t).map(({ registerId, modelType, title, description, sortOrder }) => ({
        registerId, modelType, title, description: description ?? null, sortOrder,
    }))
    return NextResponse.json(list)
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    return handleRegisterMetadataGet(searchParams)
}
```

（按需调整 **`@/`**：若 route 必须用相对 import，则用 `@lib/` 保持仓库惯例。）

测试内构造 `URLSearchParams`。

- [ ] **Step 3: GREEN**, commit "`feat(api): register metadata listing by model type`"

---

### Task 2: Models POST/PATCH 与旧表单移除

**Files:**

- Modify: `app/api/models/route.ts` — `handleModelsPost` **仅** 调 `createModel(db, body)`
- Modify: `app/api/models/[id]/route.ts` — `updateLlmModel` 等替换为 **`updateModelPatch`**：`parseModelConfig` + `prisma.update`
- Delete: `lib/validation/llm-model-schema.ts` 等对 UI 的直接绑定（若仍被脚本引用则保留迁至 `legacy`）

- [ ] **Step 1: 更新 API 集成测试**

在 `tests/` 下若存在 hitting `route` 的测试，改写 body：

```typescript
await handleModelsPost(new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({
        type: 'LLM',
        registerId: 'openai/official',
        name: '我的',
        config: { modelId: 'gpt-4o', apiKey: 'sk' },
    }),
}))
```

- [ ] **Step 2: `bun run test -- run`**, commit "`feat(api): models POST uses register payloads`"

---

### Task 3: 动态表单壳 + 一个完整 Register 表单

**Files:**

- Create: `app/settings/RegisterAddDialog.tsx`
- Create: `app/settings/register-form-map.tsx`（`'use client'`，导出 `resolveRegisterForm(registerId)` → `lazy`/`dynamic` 组件）
- Create: `app/settings/forms/OpenaiOfficialForm.tsx`（示例）

- [ ] **Step 1: `register-form-map.tsx`**

```typescript
'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

const OpenaiOfficialForm = dynamic(async () =>
    import('./forms/OpenaiOfficialForm').then(m => ({ default: m.OpenaiOfficialForm })),
)

type Props = {
    registerId: string
    initialConfig?: unknown
    onSubmit: (config: Record<string, unknown>) => void
    onCancel: () => void
}

export function RegisterConfigFormSwitcher(props: Props) {
    switch (props.registerId) {
        case 'openai/official':
            return <OpenaiOfficialForm {...props} />
        default:
            return <span className="text-error">暂未实现该 Register 的表单</span>
    }
}
```

后续 Task 逐个 **追加** case 与表单文件直到覆盖 `METADATA` 全部 SKU。

`OpenaiOfficialForm.tsx`：**daisyUI** `input`、`label`、`btn btn-primary`；本地 `useState`；`onSubmit({ modelId, apiKey })`。

- [ ] **Step 2: 修改 `AddLlmModelForm.tsx`**

流程：`fetch('/api/register-metadata?type=LLM')` → `<select>` → 打开 `<dialog className="modal">` 渲染 `RegisterConfigFormSwitcher`。

提交：`fetch('/api/models', { method: 'POST', body: JSON.stringify({ type:'LLM', registerId, name, config }) })`

失败：422 打印 `errors` toast 或 `<div className="text-error text-sm">`。

- [ ] **Step 3: RTL 单测 skeleton** — `tests/settings/register-form-switcher.test.tsx` 渲染 `'openai/official'` 出现输入框标签「API Key」（按你最终文案）。

- [ ] **Step 4:** `bun run lint`、`bun run test -- run`, commit "`feat(settings): register picker + openai official form`"

---

### Task 4: 补齐 IMAGE / SEARCH 表单

对每个 `registerId` 复制 Task 3 模式；**万相** 表单含 `capabilities.maxReferenceImages` 与 Wan 校验（≤9）；**Brave** 仅 `apiKey`。

完成后再 commit "`feat(settings): complete register-specific forms`"

---

## Plan 03 — Self-review（对照 SPEC）

| 条款 | 状态 |
| --- | --- |
| G2 | Task 1–4 |
| §6 UX | modal + 三区独立 |
| 懒加载 | `dynamic()` |
| 密钥仅 POST body | ✓ |

**缺口:** 若无全局 toast，错误展示用 daisyUI `alert alert-error`。

---

## 执行交接

下一序列：[Plan 04 — 参考图、结构化错误收口、DevTools](./2026-05-07-provider-register-plan-04-reference-errors-devtools.md)。

**推荐执行方式:** Subagent-Driven 或 Inline（同上）。
