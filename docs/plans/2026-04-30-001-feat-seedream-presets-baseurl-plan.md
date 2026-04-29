---
title: "feat: Seedream 版本预设 + 可选 API Base URL"
type: feat
status: completed
date: 2026-04-30
origin: docs/brainstorms/2026-04-23-agent-image-requirements.md
---

# feat: Seedream 版本预设 + 可选 API Base URL

## Overview

在保持 `VOLCENGINE_SEEDREAM` 单一 Provider 的前提下，为用户提供 **内置 Seedream 版本预设**（自动填充模型 ID、分辨率枚举、参考图上限、seed 开关），并支持 **可选 Base URL**（与 LLM「密钥 + endpoint」心智对齐）；请求层使用 `baseURL ?? 现有默认 LAS 路径`，不改变既有存量数据的默认行为。

## Requirements Trace

- R4 / R5：分辨率与参考图约束仍来自 `Model.capabilities`；预设仅写入与版本一致的默认值，用户仍可改为自定义。
- R2：密钥仍仅存于 Model record；endpoint 可多实例配置。

## Implementation Units（摘要）

1. **`lib/image/seedream-presets.ts`**：导出预设列表（模型 ID + 默认 capabilities 常量）。
2. **校验与持久化**：`imageModelInputSchema` 增加可选 `baseURL`；`createImageModel` 写入 `Model.baseURL`。
3. **`lib/image-provider-factory.ts`**：请求 URL 使用 `model.baseURL ?? SEEDREAM_DEFAULT_API_BASE_URL`（抽取常量）。
4. **`AddImageModelForm.tsx`**：版本预设下拉 + Base URL（可选）；自定义模式保留现行手填流量。
5. **测试**：schema、provider 集成 URL 断言、必要时更新既有工厂测试。
