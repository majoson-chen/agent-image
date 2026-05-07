---
title: 对话区不展示模型 reasoning（思维链） despite 流式已含 reasoning parts
date: 2026-05-07
category: ui-bugs
module: agent-image chat / assistant messages / AI SDK agent loop
problem_type: ui_bug
component: assistant
symptoms:
  - "启用百炼 thinking 后，助手最终回复可见，但对话区无任何「推理 / 思维链」展示"
  - "调试日志中最后一条 assistant 的 partTypes 已含 reasoning，界面仍对应段落为空白"
  - "刷新会话后仍看不到推理文本（持久化消息同样缺失 reasoning part）"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags:
  - reasoning
  - chat-ui
  - step-to-parts
  - persistence
  - dashscope
  - ai-sdk
related_components:
  - testing_framework
---

# 对话区不展示模型 reasoning（思维链） despite 流式已含 reasoning parts

## Problem

在 `providerOptions` 已注入 `enableThinking`、模型响应流中已出现 `reasoning` 类型内容时，用户仍无法在对话界面看到思维链；根因不在厂商 API，而在本仓库 **Step → UIMessage parts 转换** 与 **助手气泡渲染** 两处对 `reasoning` 的处理缺失（session history）。

## Symptoms

- 助手气泡仅展示正文 `text`（及工具块等），**没有**可展开的推理区域。
- 客户端调试可观察到 `partTypes` 含 `"reasoning"`，但 DOM 中该段 **无对应 UI**（`ChatPage` 对未知类型 `return null`）。
- **`onStepFinish` 写库** 路径下，`appendStepToParts` 此前 **丢弃** `reasoning`，刷新后仍无推理文本。

## What Didn't Work

- **误判为「完全未开 thinking」**：运行时日志可证实 `alibaba.enableThinking` 已下发（本轮调试 hypothesis **H-A** 已否定）（session history）。
- **仅依赖流式 UI**：持久化链路若丢掉 `reasoning`，刷新后与「会话真相」不一致；且原 `ChatPage` 仍未渲染该类型（**H-B / H-C**）（session history）。

## Solution

1. **`lib/ai/step-to-parts.ts` — `appendStepToParts`**
    - 对 `step.content` 中 `type === 'reasoning'` 且 `text` 已定义的分支，追加 UI part：`{ type: 'reasoning', text }`，与 `text` / `tool-*` 同级进入累积数组，随 `upsertAssistantMessage` 落库。

2. **`app/conversations/[id]/ChatPage.tsx`**
    - 在助手 `parts.map` 中增加 `part.type === 'reasoning'` 分支，使用语义色容器与原生 `<details>` / `<summary>` 展示 **「推理过程（思维链）」**，正文用等宽小号字预格式化，避免硬编码调色板。

3. **`tests/ai/step-to-parts.test.ts`**
    - 将原「非 text/tool 即忽略」用例改为 **`preserves reasoning before text`**，固定期望数组含 `step-start`、`reasoning`、`text`。

提交语义（仓库历史）：`fix(chat): persist and render reasoning parts for thinking-capable models`（session history）。

## Why This Works

- AI SDK / DashScope 已在 **Step 内容**中产出 `reasoning`；此前注释写明「reasoning…忽略」，导致 **DB 与产品叙事脱节**。
- `useChat` 侧消息 `parts` 已能携带 `reasoning`，缺的是 **渲染分支**；补齐后流式与落库路径一致。

## Prevention

- 新增 **AI SDK content 类型**（或 Provider 特有块）时，**同时**检查：`appendStepToParts`（或等价归一化层）与 **对话渲染** 的 `switch`/分支是否覆盖；必要时补 **Vitest 纯函数** 断言（本仓库已有 `step-to-parts` 测试夹具）。
- 若再遇「流里有、界面无」，优先对比 **服务端 step.content 类型列表** 与 **客户端 `partTypes`**，缩小是 **丢弃** 还是 **未渲染**。

## Related Issues

- [DashScope SKU 思考模式设置页披露做法](../developer-experience/dashscope-sku-thinking-settings-visible-2026-05-07.md) — 互补：该条解决「设置里找不到 thinking」心智；本条解决「已开 thinking 但对话仍不见思维链」的 **persist + UI** 缺口。
- [missing-tool-results / image approval 与 step-to-parts](../runtime-errors/missing-tool-results-image-approval-ai-sdk-2026-05-03.md) — 同文件不同问题；说明 `step-to-parts` 是对话产物归一化的关键枢纽。
