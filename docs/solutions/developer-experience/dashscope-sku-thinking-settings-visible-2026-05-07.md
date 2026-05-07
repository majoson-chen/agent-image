---
title: DashScope SKU（Kimi K2.6 / Qwen 3.6 Plus）思考模式仅在设置披露时的表单做法
date: 2026-05-07
category: developer-experience
module: agent-image settings / LLM register forms / Alibaba DashScope
problem_type: developer_experience
component: assistant
severity: low
applies_when:
  - "产品上已去掉对话内的思考切换，仅以 Model config / providerOptions 驱动百炼 thinking"
  - "SKU Register 表单里仍可填 baseURL、thinking_budget，但缺少整块「启用思考」时用户会认为没有 thinking 配置"
resolution_type: code_fix
tags:
  - dashscope
  - kimi-k2-6
  - qwen-3-6-plus
  - thinking
  - supports-thinking
  - settings-forms
related_components:
  - documentation
---

# DashScope SKU（Kimi K2.6 / Qwen 3.6 Plus）思考模式仅在设置披露时的表单做法

## Context

对话 Agent 侧的「思考」已改为 **只由 Provider / 模型 `config.capabilities` 决定**（`computeLlmChatProviderOptions`、`dashScopeThinkingEnabledFromConfig` 等）。DashScope SKU（`alibaba/dashscope-kimi-k2-6`、`alibaba/dashscope-qwen3-6-plus`）设置页里虽已存在 **`思考过程 Token 上限`**（`thinking_budget`）以及一个反向的「**禁用思考模式（隐藏会话内开关）**」toggle，但在会话内开关删除后：

- 「禁用…隐藏会话内开关」语义过期，易造成「这里没有 thinking 配置」的误判；
- 正向能力散落在 `DashScopeConnectionFields` 的第二个 fieldset（标题像连接参数而非「思考模式」整块），SKU 没有像通用 `alibaba/dashscope-llm` 那样明显的 **`supportsThinking` 勾选建模**。

## Guidance

1. **拆分共用字段组件**
   将 `app/settings/register-forms/llm/DashScopeConnectionFields.tsx` 拆为：
    - `DashScopeBaseUrlFields`
    - `DashScopeThinkingBudgetFields`
      原 `DashScopeConnectionFields` 仍组合二者，避免破坏自填 DashScope LLM 表单。

2. **SKU 表单布局顺序**
    - Base URL → **独立 fieldset「思考模式（百炼）」**（短文说明：**对话页不再切换**；开关对应服务端下发的 `enable_thinking` / 可选 `thinking_budget`）→ **「启用思考模式」toggle（默认开启）** → `DashScopeThinkingBudgetFields`。

3. **落库语义**
   保存时对 SKU **始终写入** `config.capabilities.supportsThinking`（`true` / `false`），与界面一致；`thinkingBudget` 仍仅在非空时写入。服务端 SKU 分支逻辑为 **`supportsThinking !== false`**：显式 `true` 与历史「未写字段」均视为开启，兼容旧记录。

4. **Schema / 注释**
   `lib/providers/registers/alibaba-dashscope-shared.ts` 中 `supportsThinking` 的注释应反映「服务端开关」，不要再写「会话内勾选」。

5. **测试**
   在 `tests/validation/llm-model-schema.test.ts`（或等价处）覆盖 SKU **`capabilities.supportsThinking: true`** 可被 `parseModelConfig` 接受。

## Why This Matters

Institutional knowledge：**设置页是用户对「有没有 thinking」的唯一心智入口**；若只有反向「禁用」和晦涩小节标题，支持与产品叙事（thinking 仅在配置层控制）脱节，会直接引发误报与支持成本。显性 fieldset + 默认开启的 toggle 低成本对齐心智，且不改变运行时默认行为（旧数据仍可不带 `supportsThinking`）。

## When to Apply

- 新增或调整 **DashScope SKU** 或其他「默认开 thinking、仅能通过 `capabilities` 关掉」的 Register 表单时；
- 任何 **移除对话 UI 控制能力** 后，仍依赖 **同源配置字段**（如旧的「隐藏会话内 xxx」文案）需要同步重写时。

## Examples

**之前（易产生误解）**：`AlibabaDashscopeKimiK26ModelForm` 仅用 `DashScopeConnectionFields` 堆叠 URL + Token 上限，下方单独一行「禁用思考模式（隐藏会话内开关）」。

**之后**：在同一表单中，`DashScopeBaseUrlFields` 与下方「思考模式」fieldset、`启用思考模式` toggle、`DashScopeThinkingBudgetFields` 分层呈现；submit 拼装 `capabilities` 如上。

运行时仍参考：

- `lib/llm-chat-provider-options.ts` — `dashScopeThinkingEnabledFromConfig`（SKU：`supportsThinking !== false`）、`computeLlmChatProviderOptions`。

## Related

- [Model 使用 registerId + Json config …](architecture-patterns/model-registerid-config-register-metadata-2026-05-07.md) — Register / 设置整体契约（与本条互补：本条专指 SKU thinking 披露的 UX 与 `capabilities` 写法）。
