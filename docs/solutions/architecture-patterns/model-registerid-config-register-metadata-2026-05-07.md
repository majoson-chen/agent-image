---
title: Model 使用 registerId + Json config，与 register-metadata / 设置页对齐
date: 2026-05-07
category: architecture-patterns
module: agent-image providers / Model / settings
problem_type: architecture_pattern
component: assistant
severity: medium
applies_when:
  - "新增 Register、改 lib/providers/registry 或设置页 Model 表单"
  - "改 LLM / 生图工厂分发逻辑或 prisma Model 字段"
  - "更新 canvases 或 SPEC，避免再写已废弃的 providerType 扁平字段"
tags:
  - register-id
  - register-metadata
  - model-config
  - settings-forms
  - provider-factory
  - cursor-canvas
related_components:
  - documentation
  - tooling
---

# Model 使用 registerId + Json config，与 register-metadata / 设置页对齐

## Context

SQLite `Model` 已从「`type` + 枚举 **`providerType`** + 多张扁平列」迁移为：**`registerId`（静态目录 SKU）+ `type` + `name` + `Json config`**，由 `parseModelConfig(registerId, config)` 与各 Register 下的 Zod schema 对齐。若 UI、工厂或人类文档仍按旧字段心智建模，会与真实代码分叉。

本轮落地还包括：只读 **`GET /api/register-metadata?type=LLM|IMAGE|SEARCH`**；设置页 **`name`（展示）与 HTTP 请求的 model 字段分离**（LLM 用 **`config.modelId`**，图像用 **`config.requestModel`**）；万相在能力允许时的 **`referenceImageIds`**；开发环境下可选的 LLM DevTools 包裹；以及 **`canvases/`** 画布与 schema 对齐（不再以 `VOLCENGINE_SEEDREAM` 等旧枚举为主叙述）。

## Guidance

1. **单一真相：`registerId` + `config`**
    - Prisma：`prisma/schema.prisma` 中 `Model.registerId`、`Model.config`。
    - 目录：`lib/providers/registry.ts`（`listRegisterMetadata`、`parseModelConfig`）；各 Register：`lib/providers/registers/*.ts`。
    - LLM 工厂：`lib/llm-provider-factory.ts` 按 `model.registerId` 三分支（`openai/official`、`openai-compatible/generic`、`alibaba/dashscope-llm`）。
    - 图像工厂：`lib/image-provider-factory.ts` 按 `volcengine/seedream` / `dashscope/wan-image` 解析 config 并发起 HTTP。

2. **设置 UI 契约**
    - 打开表单时 **`fetch('/api/register-metadata?type=…')`** 填充 Register 条目；失败或加载中回退硬编码选项（图像须保留 Seedream / 万相 二选一）。
    - **SEARCH**：仅当服务端返回 **`registerRows.length > 1`** 时展示 Register 下拉（与单列目录一致）。
    - **IMAGE**：若目录仅一行则**不展示下拉**，固定该项并给说明条；多于一行用接口数据；加载/失败用静态两项。
    - POST `/api/models` 体：**`registerId`、`name`、以及 Register 专属的 `config` 形状**（含 `requestModel` 或 `modelId`、`apiKey`、`capabilities` 等）。

3. **人类画布**
    - 仓库画布在 **`canvases/*.canvas.tsx`**（非 Cursor 托管路径）；架构类叙述应写 **`registerId` / `config.*`**，避免把 `Model.name` 说成下游 HTTP 的 model 字段。

## Why This Matters

- **`name` 与请求模型分离**：列表可读性与 Provider 合同解耦；迁库与多模型并排更稳。
- **Register 静态目录**：新增厂商时扩 `registry` + register 模块 + （必要时）表单回退选项，而非再堆 Prisma 枚举扁平列。
- **画布与 SPEC 漂移**会直接误导后续设计与 Code Review；与 **AGENTS.md** 中「compound / solutions」检索习惯一致。

## When to Apply

- 改动 **`app/api/models`**、**`/api/register-metadata`**、**`lib/providers/registry`**、任一 **`Add*ModelForm`**。
- 调整 **生图参考图**、**结构化错误 / 密钥脱敏** 等与 **`registerId`** 绑定的工具层行为。
- 维护 **Cursor Canvas** 中数据模型或 Provider 工厂说明时。

## Examples

**Before（废弃心智）**：`providerType = VOLCENGINE_SEEDREAM`，`Model.name` 即请求里的 model。

**After（当前）**：`registerId = "volcengine/seedream"`，`name = "我的 Seedream"`，`config.requestModel = "doubao-seedream-4-5-251128"`，工厂读 **`config`** 组装 body。

## Related

- 画布存放约定：`docs/solutions/conventions/repo-local-cursor-canvas-canvases-2026-05-03.md`
- Register 静态实现：`lib/providers/registry.ts`、`app/api/register-metadata/route.ts`
- Full compound 会话分支参考：`refactor/provider-v2`（文档编写时）

## Overlap Assessment (compound internal)

对照 `docs/solutions/` 现存条目：**重叠度低**（无同题的 register 迁移文）；上与 **canvas 公约**为**弱相关**，仅交叉引用路径与维护动机。
