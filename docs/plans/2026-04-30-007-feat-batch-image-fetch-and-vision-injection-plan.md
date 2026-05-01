---
title: "feat: 移除用户上传 + 批量 image-fetch + 合成 user 注入（ToolLoop）"
type: feat
status: active
date: 2026-04-30
---

# feat: 移除用户上传 + 批量 image-fetch + 合成 user 注入（ToolLoop）

对话结论收束见本会话；本节为 **HOW**（可执行拆分与文件清单）。**不预先写实现代码。**

## Overview

1. **砍掉用户上传参考图**及 `image-ref` 全链路，降低与「统一由工具提供视觉上下文」的冲突（**同一期第一步**）。
2. **扩展 `image-fetch`**：单次请求多源（公网 `url` + 本会话已有 `imageId`），有序、最多约 10；**逐项成败**（失败项带索引与原因）；工具返回结构化 `items` 供 Prompt 与后续注入对齐。
3. **视觉上下文契约**：模型**不调 `image-fetch` 则不注入**看图上下文；需自检生图等路径依赖模型按 System Prompt **显式调用** `image-fetch`（传入刚得到的 `imageId` 或 URL）。
4. **注入形态**：在 tool 成功后，遵循 OpenAI-compat 习惯——**先有含 `tool_calls` 的 assistant 与 `tool` 结果，再允许模型生成一轮 assistant**，随后编排层 **写入一条独立 `role=user` 的合成消息**（固定包裹文案 + 与 `items` 顺序一致的多个 `file` data URL part），**同步 DB**。**百炼 compat 校验本期 defer**。
5. **`ToolLoopAgent`**：沿用 `createAgentUIStreamResponse`。在 **`prepareStep`** 中对发给模型的 **`messages`** 做与 DB 对齐的增补（参见 AI SDK 6 `node_modules/ai/docs/03-agents/04-loop-control.mdx` 「Message Modification」）；或由「DB 已写入合成 user」+ 后续 step 自动进入历史——实现时在 U2 **择一主路径**，另一路径写入 Risk。

---

## Requirements Trace（来自对话）

| ID  | 内容                                                                                     |
| --- | ---------------------------------------------------------------------------------------- |
| R1  | 删除用户上传与 `image-ref` 及相关 API/UI/测试。                                          |
| R2  | `image-fetch` 支持批量源；顺序与注入 text 中的 **slot ↔ imageId（及失败项说明）** 一致。 |
| R3  | 合成注入为**独立 user 消息**，入库；UI 暂不隐藏（debug）。                               |
| R4  | `image-fetch`**不需要**审批；生图保留现有审批。                                          |
| R5  | 去掉 `hydrate-images` 及「往最后一条 user 塞 assistant 图」等行为。                      |
| R6  | 上传移除后 **不再暴露** `image-generate` 的 `referenceImageIds`（避免半截能力）。        |

---

## Scope Boundaries

- **不做**：百炼/OpenAI-compat 消息顺序的强 gate（实现后本地再验）。
- **不做**：从 Prisma enum 移除 `USER_UPLOAD`（保留兼容历史 DB 行即可）。
- **可选后续**：前端隐藏注入文案、`batchId` 幂等。

---

## Affected Surfaces（删除/调整清单）

### 删除或大幅删减

| 路径                                                             | 动作                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `lib/ai/hydrate-images.ts`                                       | **删除文件**（无调用方后）。                                                                     |
| `app/api/chat/route.ts`                                          | 去掉 `hydrateImagesForLLM` import 与调用。                                                       |
| `app/api/images/route.ts`                                        | **删除 `POST`**（`handleImagesPost`）；保留 **GET** `images/[id]` 若生图/fetch 仍通过 URL 展示。 |
| `app/conversations/[id]/ChatPage.tsx`                            | 移除上传、`image-ref` 组装与相关渲染分支（若已无 part 类型则删 case）。                          |
| `lib/tools/image-generate.ts`                                    | 移除 `referenceImageIds` 相关 schema 与 execute 传参。                                           |
| `lib/image-provider-factory.ts`                                  | 删除或空转 reference 读取循环（参数可删）。                                                      |
| `tests/ai/hydrate-images.test.ts`                                | **删除**。                                                                                       |
| `tests/conversations/ChatPage.test.tsx`                          | 删除 `image-ref`/上传相关用例。                                                                  |
| `tests/conversations/conversation-page-initial-messages.test.ts` | 删除或改写 `image-ref` SSR 断言。                                                                |
| `tests/api/images/upload.test.ts`                                | **删除**或改为 POST 不存在。                                                                     |

### 扩展与新建

| 路径                                              | 动作                                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `lib/tools/image-fetch.ts`                        | `sources[]`：`url \| imageId` 互斥项、最多 10、逐项错误、有序 `items`。                                                            |
| `lib/tools/tool-registry.ts`                      | 更新工具描述。                                                                                                                     |
| `lib/ai/build-agent.ts` + `app/api/chat/route.ts` | `prepareStep` / `experimental_context`；必要时 `onFinish`；与 `createAgentUIStreamResponse` 行为查阅 `node_modules/ai/docs` 确认。 |
| `lib/db/messages.ts`                              | 新增插入 **合成 user** `parts` 的 helper。                                                                                         |
| `lib/ai/system-prompt.ts`                         | 增补 `image-fetch` 调用约定与生图自检说明。                                                                                        |

---

## Implementation Units（执行顺序：U0 → U1 → U2 → U3）

**Execution note：** 默认可自动化行为遵循 **TDD**（`AGENTS.md`）。

### U0 — 移除用户上传、`hydrate`、`image-ref`、生图参考图

**Goal:** 一期首步清场。

**Tests:** 删/改上传测、hydrate 测、ChatPage、image-generate schema 测、image-provider-factory 中含 ref 的用例。

**Requirements:** R1, R6, R5

### U1 — 批量 `image-fetch`

**Tests:** `tests/tools/image-fetch.test.ts`（混合源、部分失败、顺序、>10 拒绝）。

**Requirements:** R2

### U2 — 合成 user 入库 + `prepareStep`（或等价）对齐 Core `messages`

**Tests:** DB helper 单测 + 按需 chat 集成。

**Requirements:** R3

### U3 — System Prompt 与 registry 收尾

**Requirements:** R2, R4

---

## Risks / Deferrals

| 风险                                       | 缓解                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| `prepareStep` 的 `messages` 与 UI 流不同步 | **DB** 写入合成 user，SSR/history 以 DB 为准。             |
| stream 生命周期与 `onFinish` 写库          | 查 AI SDK 6 文档与类型，避免在 response 已关闭后无效写入。 |

---

## Next Workflow

1. Review 本计划。
2. **`ce-work`** 或本会话按 **U0→U1→U2→U3** 实现；单元末 **`bun test`**、**`bun --bun tsc --noEmit`**。

---

## References

- `node_modules/ai/docs/03-agents/04-loop-control.mdx`（`prepareStep` / `messages`）
- 现状：`app/api/chat/route.ts`、`lib/ai/build-agent.ts`
