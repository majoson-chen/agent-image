# Register Hook — Plan 05：Settings / Validation 单一真源

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 **与 Catalog 并行的硬编码列表**：`AddLlmModelForm` 的 `fallbackLlmRegisterOptions`、`AddImageModelForm` 的 **`ImageVendor` / `registerId` 三分支**；HTTP POST **创建 Model** 的 body 校验尽可能 **由 `registerId` 决定 schema**（与 `parseModelConfig` 同源）。

**Architecture:**  
1. **客户端 fallback**：新建 `lib/providers/register-metadata-fallback.ts`，导出 `fallbackRegisterOptions(modelType: ModelType): Array<{ registerId: string; title: string }>`，数据 **手抄自** `REGISTER_CONFIG_CATALOG` 的 `registerId` + `title`（文件头注释要求：改 Catalog 时同步改此文件）。`AddLlmModelForm` / `AddImageModelForm` / `AddSearchModelForm` 在 fetch 失败时使用该函数。  
2. **IMAGE vendor 标签**：删除 `imageVendorFromRegister` 的 **双分支**；改为 Catalog **metadata** 新增可选字段 `imagePresetKind?: 'wan' | 'seedream'`（在 `lib/providers/types.ts` 的 `RegisterMetadata` 扩展）并在 `register-config.ts` 两行 IMAGE 补上；`AddImageModelForm` 读 `getRegisterMetadata(id)?.imagePresetKind`。  
3. **Validation**：在 `lib/validation/model-upsert-schema.ts` 或独立中间件中，对 `POST /api/models` body **先取 `registerId`**，再 `parseModelConfig(registerId, config)` 合并校验（若与现有 `modelCreateBodySchema` 冲突，采用 **superRefine** 调用 `parseModelConfig`）。

**Tech Stack:** `zod`、React client components、Vitest。

**前置:** Plan 01（类型扩展 metadata 时需改 `RegisterMetadata`）。

---

## 文件职责

| 路径 | 职责 |
| --- | --- |
| `lib/providers/types.ts` | `RegisterMetadata` 增加可选 `imagePresetKind?` |
| `lib/providers/register-config.ts` | 两行 IMAGE 填 `imagePresetKind` |
| `lib/providers/register-metadata-fallback.ts`（新建） | fallback 列表 |
| `app/settings/AddLlmModelForm.tsx` | `fallbackLlmRegisterOptions()` → import fallback |
| `app/settings/AddImageModelForm.tsx` | 使用 `imagePresetKind`；删除硬编码 wan/seedream 标题映射 |
| `lib/validation/model-upsert-schema.ts` / `model-create-body` | superRefine + parseModelConfig |

---

### Task 1: 扩展 `RegisterMetadata`

**Files:**
- Modify: `lib/providers/types.ts`
- Modify: `lib/providers/register-config.ts`

- [ ] **Step 1:** 在 `RegisterMetadata` 增加：

```typescript
    /** 仅 IMAGE：设置页选用何种预设组件；未设则表单用通用字段 */
    imagePresetKind?: 'wan' | 'seedream'
```

- [ ] **Step 2:** 对 `dashscope/wan-image` 设 `imagePresetKind: 'wan'`，`volcengine/seedream` 设 `'seedream'`。

- [ ] **Step 3:** `bun run test -- run tests/api/register-metadata.test.ts`

- [ ] **Step 4: Commit** `feat(providers): RegisterMetadata imagePresetKind`

---

### Task 2: `register-metadata-fallback.ts`

**Files:**
- Create: `lib/providers/register-metadata-fallback.ts`

- [ ] **Step 1:** 实现（示例片段，**须与当时 Catalog 行数一致**）：

```typescript
import type { ModelType } from '~/generated/prisma/client'

export function fallbackRegisterMetadataRows(type: ModelType): Array<{ registerId: string; title: string }> {
    if (type === 'LLM') {
        return [
            { registerId: 'openai/official', title: 'OpenAI 官方' },
            { registerId: 'openai-compatible/generic', title: 'OpenAI 兼容（通用）' },
            { registerId: 'alibaba/dashscope-kimi-k2-6', title: '阿里云百炼 Kimi K2.6' },
            { registerId: 'alibaba/dashscope-qwen3-6-plus', title: '阿里云百炼 Qwen 3.6 Plus' },
            { registerId: 'alibaba/dashscope-llm', title: '阿里云 DashScope LLM（自填模型）' },
        ]
    }
    if (type === 'IMAGE') {
        return [
            { registerId: 'volcengine/seedream', title: '火山方舟 Seedream' },
            { registerId: 'dashscope/wan-image', title: 'DashScope 万相图像' },
        ]
    }
    return [{ registerId: 'brave/search', title: 'Brave Web/Image Search' }]
}
```

- [ ] **Step 2:** 替换各 `Add*ModelForm` 内联 fallback。

- [ ] **Step 3: Commit** `feat(settings): shared register metadata fallback module`

---

### Task 3: `AddImageModelForm` 去分支

**Files:**
- Modify: `app/settings/AddImageModelForm.tsx`

- [ ] **Step 1:** 删除 `imageVendorFromRegister`；改为 `getRegisterMetadata(form.registerId)?.imagePresetKind ?? 'seedream'`（默认值与产品确认；若必须无默认，则强制从 metadata）。

- [ ] **Step 2:** 运行 `bun run test`（若有 UI 测）或手动 smoke settings 页。

- [ ] **Step 3: Commit** `refactor(settings): image form uses Catalog imagePresetKind`

---

### Task 4: POST body 与 `parseModelConfig` 对齐

**Files:**
- Modify: `lib/validation/model-upsert-schema.ts`
- Modify: `tests/api/models.test.ts`

- [ ] **Step 1:** 在 `modelCreateBodySchema`（或等价）上 `.superRefine((data, ctx) => { try { parseModelConfig(data.registerId, data.config) } catch (e) { ... } })`。

- [ ] **Step 2:** 添加测试：无效 config 返回 422。

- [ ] **Step 3: Commit** `feat(api): model create validates config via parseModelConfig`

---

## Plan 05 — Self-review

| 单一真源 | Task 1–4 |
| G2 设置页 | Task 2–3 |

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-08 | 初版 |
