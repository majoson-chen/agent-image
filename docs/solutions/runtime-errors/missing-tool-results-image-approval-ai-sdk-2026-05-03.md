---
title: 主生图工具批准后 MissingToolResultsError 与确认循环
date: 2026-05-03
category: runtime-errors
module: agent-image / POST /api/chat + AI SDK ToolLoopAgent
problem_type: runtime_error
component: assistant
symptoms:
  - "useChat 顶栏报错：Tool result is missing for tool call functions.image-generate-primary:N"
  - "用户已点「确认」，仍无法进入生成流程或反复出现确认/等待态"
  - "调试日志中 tool-approval 后 DB 构图里生图 part 仍为 input-available、且无 approval.approved"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags:
  - vercel-ai-sdk
  - tool-approval
  - convertToModelMessages
  - image-generate-primary
  - narrow-chat-transport
related_components:
  - tooling
---

# 主生图工具批准后 MissingToolResultsError 与确认循环

## Problem

在 `ToolLoopAgent` + `needsApproval` 主生图链路中，用户点击确认后服务端或客户端仍抛出 **`MissingToolResultsError`**（文案含 **`Tool result is missing for tool call functions.image-generate-primary`**），或出现 **重复确认**。根因是三处应用逻辑与 **AI SDK `convertToModelMessages` / `convertToLanguageModelPrompt`** 对「工具调用是否已合法闭环」的判定不一致（session history：与窄 body、DB 构图 refactor 同期排查）。

## Symptoms

- **`error.message`** 来自 AI SDK：某条 **`tool-call`** 在后续 **user** 消息前既无 **`tool-result`**，也未通过 **`tool-approval-response` + `approvedToolCallIds`** 消解。
- UI 上出现 **「已确认，准备生成…」**（客户端内存为 `approval-responded`）与 **红条报错** 同时存在：说明 **客户端状态** 与 **服务端从 DB 读出的 assistant `parts` 形状** 不一致。

## What Didn't Work

- **仅在有后续 user 时收窄 repair**：`repairDanglingImageGenerateToolParts` 若把 **已批准、待同轮执行** 的 `input-available` 误收成 `output-denied`，会导致模型认为调用被拒绝而 **重复生图/确认**；但若不做「仅有后续 user 才 repair」，又会在 tool-approval 续跑上误伤。最终采用 **按 assistant 索引判断其后是否存在 user** 的条件 repair（与「新 user 打断未闭合一类悬空 tool」兼容）。
- **`applyToolApprovalsToParts` 只处理 `approval-requested` 且要求 `part.approval.id` 存在**：实际落库里常见 **仅有 `input-available`、`toolCallId`、`input`，但没有 `approval` 对象**（见下），导致 HTTP 虽携带 `approvalId`，服务端 **early return**，批准确永远不写入 DB。
- **批准合并写成 `input-available` 但不写 `approval.approved: true`**：`convertToModelMessages` 仅在 **`part.approval.approved != null`** 时生成 **`tool-approval-response`**，否则会话重载后仍缺闭环 → 同一条 `MissingToolResultsError`。应改为 **`approval-responded` + `approved: true`**（与客户端 `addToolApprovalResponse` 一致）。

## Solution

对齐 SDK 契约，并补齐 **落库 part** 与 **HTTP 审批负载** 的匹配维度。

1. **`lib/ai/repair-dangling-image-generate-parts.ts`**  
   仅当 **该条 assistant 之后还存在至少一条 user** 时，才把主/次生图未完结状态收成 `output-denied`；避免 tool-approval 续跑（末尾 assistant、后无 user）被误伤。

2. **`lib/ai/tool-approval-parts.ts` — `applyToolApprovalsToParts`**  
   - 批准：**`approval-responded`**，**`approval: { id: decision.approvalId, approved: true }`**（`id` 以 HTTP 的 `approvalId` 为准）。  
   - 匹配决策：**先 `part.approval.id`，再 `approvals[].toolCallId === part.toolCallId`**。  
   - 可合并状态：**`approval-requested`**，或 **`input-available` 且 `approval.approved !== true`**（含无 `approval` 对象的条）。  
   - **删除**「无 `approval.id` 则直接 return」——否则会永久无法合并「丢 approval 的 input-available」。

3. **`lib/ai/step-to-parts.ts` — `appendStepToParts`**  
   当 step 仅有 **`tool-call` 尚无 `tool-result`**、写入 **`input-available`** 时，从 **同 `toolCallId` 的前序 tool part** 拷贝 **`approval`**，避免新条抹掉 `approval.id`。

4. **窄传输与校验**  
   - **`lib/chat/narrow-chat-transport-body.ts`**：`collectApprovalsFromAssistantMessage` 附带 **`toolCallId`**。  
   - **`lib/validation/chat-post-schema.ts`**：`approvals[]` 项增加可选 **`toolCallId`**。

5. **`app/conversations/[id]/ChatPage.tsx`**  
   渲染 **`approval-responded`**（如「已确认，准备生成…」），避免无分支导致空白。

## Why This Works

AI SDK 在整理发往模型的 prompt 时，对每个未 `providerExecuted` 的 **`tool-call`**，要求在遇到下一则 **user** 前必须有 **`tool-result`**，或 **`approvedToolCallIds`** 中含该 `toolCallId`（由 **`tool-approval-request` / `tool-approval-response`** 配对产生）。  
`convertToModelMessages` 只在 tool UI part 上 **`approval.approved` 已赋值** 时写入 **`tool-approval-response`**。因此：**DB 行必须是 `approval-responded` + `approved: true`，或至少可通过 HTTP 合并成该形状**；**不能**长期停留在「像已批准」的 `input-available` 却无 `approved`。**`toolCallId` 回传**解决 **落库丢失 `approval.id`** 时的匹配问题。

## Prevention

- **改 `applyToolApprovalsToParts` / `appendStepToParts` 时**：用 Vitest 覆盖三类数据——**`approval-requested`**、**`input-available` 带 `approval.id` 无 `approved`**、**`input-available` 仅 `toolCallId`** + HTTP **`toolCallId`**。  
- **回归**：`tool-approval` 后从 DB `listMessages` 读出的最后一条 assistant 生图 part 应为 **`approval-responded`**（调试期曾用 `pre-repair` 日志断言；现已移除 ingest）。  
- **阅 SDK**：涉及审批与消息转换时对照本地 **`node_modules/ai/dist/index.mjs`** 中 `convertToModelMessages` 与 `convertToLanguageModelPrompt` 分支，避免仅凭猜测状态机。

## Related Issues

- 多模态与 `convertToModelMessages`（相对路径 hydrate）：[`docs/solutions/design-patterns/composer-user-image-upload-multimodal-2026-05-03.md`](../design-patterns/composer-user-image-upload-multimodal-2026-05-03.md)（**低重叠**，不同问题域）。  
- 代码锚点（实现以仓库当前版本为准）：`lib/ai/tool-approval-parts.ts`、`lib/ai/step-to-parts.ts`、`lib/ai/repair-dangling-image-generate-parts.ts`、`app/api/chat/route.ts`、`lib/chat/narrow-chat-transport-body.ts`、`lib/validation/chat-post-schema.ts`。
