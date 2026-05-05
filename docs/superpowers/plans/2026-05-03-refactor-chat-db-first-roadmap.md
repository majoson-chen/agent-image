# 聊天 DB 唯一源 + 窄请求体 —— 总 RoadMap（Harness）

> **For agentic workers:** 本文件为 **元计划 / Harness**：只描述分层目标、边界、依赖与 SPEC 映射，**不包含**逐步实现代码。每个 Layer 后续单独开 `docs/superpowers/plans/` 下的 **子计划**，用 `superpowers:writing-plans` 产出可执行 Task/Step。
>
> **Goal:** 按 SPEC 将聊天闭环迁移为 **DB 唯一事实源 + HTTP 窄 body + 服务端外圈多段生成**，且 **Message 表**收缩为时间序 + `payload(Json)` 形态。
>
> **Architecture:** **自下而上分层**：Schema/迁移 → DB 访问与 SSR 映射 → POST 契约（Zod）→ Chat 路由与 `ToolLoopAgent` 编排 → 前端 `prepareSendMessagesRequest` → 删旧合并路径与整体验收。垂直场景（user-turn / tool-approval / 附件 / image-fetch）在 **Layer 4** 串起，不在前几层重复拆子项目。
>
> **Tech Stack:** Next.js App Router、Prisma + SQLite、AI SDK（`useChat`、`ToolLoopAgent`、`createUIMessageStream` / merge）、Bun + Vitest、Zod。

**权威 SPEC：** [docs/superpowers/specs/2026-05-03-refactor-chat-db-first-narrow-body-spec.md](../specs/2026-05-03-refactor-chat-db-first-narrow-body-spec.md)

---

## 依赖顺序（总览）

```text
Layer 1  Schema 与迁移
    → Layer 2  DB 访问与 initial 映射
        → Layer 3  HTTP 契约（Zod）
            → Layer 4  Chat 路由 + Agent 运行时
                → Layer 5  前端 Transport
                    → Layer 6  收尾与整体验收
```

---

## Layer 1：持久化形态与迁移（数据层）

| 项       | 内容                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标** | 落实 SPEC **G7、§10**：`Message` 以 `id`、`conversationId`、`createdAt`、`payload(Json)`（列名实施时可微调）为真源；旧列退场策略、backfill、Toy 是否一步切换 / 短期双读 —— **在本层书面定稿并落地 migrate**。 |
| **做**   | `prisma/schema.prisma`、迁移、(如需) backfill；与 `payload` 形状相关的生成类型。                                                                                                                              |
| **不做** | 不改 `app/api/chat/route.ts`、`useChat`、不写 Agent 业务分支。                                                                                                                                                |
| **产出** | 表结构稳定，供后续层冻结「读写列名与 `payload` 语义」。                                                                                                                                                       |
| **SPEC** | §10 全文。                                                                                                                                                                                                    |

**建议子计划文件名（示例）：** `2026-05-03-chat-db-first-layer-01-schema-migration.md`

---

## Layer 2：消息仓储与 SSR 映射（数据访问层）

| 项       | 内容                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **目标** | **G1**（`listMessages` 即为构图主源之一）、**G3**（user 行 id 与客户端一致，upsert 语义在仓储层可满足）；`initialMessages` / 会话时间线与 **`payload`** 读写一致。 |
| **做**   | `lib/db/messages.ts`、`lib/conversations/initial-messages.ts` 等；若 SPEC 允许迁移期兼容，**兼容读旧列**也只放本层，不放路由。                                     |
| **不做** | HTTP 解析、Agent、`prepareSendMessagesRequest`。                                                                                                                   |
| **依赖** | Layer 1 完成。                                                                                                                                                     |
| **SPEC** | G1、G3、G7；§5 步骤 2–3 依赖的持久化能力；§11 索引。                                                                                                               |

**建议子计划文件名（示例）：** `2026-05-03-chat-db-first-layer-02-db-access.md`

---

## Layer 3：窄请求体校验与对外契约（协议层）

| 项       | 内容                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标** | **G2（服务端侧）** + **§4**：`conversationId`、`kind`、`user-turn` / `tool-approval` 字段集与 **禁止**依赖整包 `messages` —— 用 Zod（及导出类型）冻结。 |
| **做**   | `lib/validation/chat-post-schema.ts`；可含 body → 内部 DTO 的纯函数；**针对 schema 的单元测试**。                                                       |
| **不做** | 不启动 Agent、不写流式响应。                                                                                                                            |
| **依赖** | 与 Layer 1/2 在 **`messageId` / `assistantMessageId` / `parts` ↔ `payload.parts`** 上语义对齐（类型或注释中写明即可）。                                 |
| **SPEC** | G2、G4；§4 全文。                                                                                                                                       |

**建议子计划文件名（示例）：** `2026-05-03-chat-db-first-layer-03-http-contract.md`

---

## Layer 4：Chat 路由与 Agent 运行时（编排 + 模型层）

| 项       | 内容                                                                                                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标** | **G1、G4、G5、G6** 及 **§5–§6**：按 §5 顺序处理 user-turn / tool-approval；从 DB 构图；目标态 **不再走** `mergeClientMessagesWithDbForModel`；**外圈循环** + `stopWhen` 与步数上限；step 结束同步 DB；**hydrate** `/api/images/{id}` 引用（可与现有函数同职责）。垂直场景在本层串联。 |
| **做**   | `app/api/chat/route.ts`、`lib/ai/*`；`createUIMessageStream` + `writer.merge` 或等价；可对路由做 **伪造窄 body** 的集成测以不依赖 Layer 5。                                                                                                                                           |
| **不做** | 前端 Transport（Layer 5）。                                                                                                                                                                                                                                                           |
| **依赖** | Layer 2 + Layer 3。                                                                                                                                                                                                                                                                   |
| **SPEC** | G1、G4、G5、G6；§5、§6、§7；§8 中偏服务端部分。                                                                                                                                                                                                                                       |

**建议子计划文件名（示例）：** `2026-05-03-chat-db-first-layer-04-chat-route-agent.md`

---

## Layer 5：客户端 Transport（UI 对接层）

| 项       | 内容                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标** | **G2（客户端侧）**：`prepareSendMessagesRequest` 仅发 §4 JSON，**不**原样转发完整 `messages`；审批自动发送与 **`assistantMessageId` / `approvals`** 对齐 §4.3–4.4。 |
| **做**   | `app/conversations/[id]/ChatPage.tsx`（或抽离的 Transport 模块）。                                                                                                  |
| **不做** | 不改 Prisma；尽量不反向改动 Layer 4 已冻结语义。                                                                                                                    |
| **依赖** | Layer 3 契约冻结；Layer 4 可联调。                                                                                                                                  |
| **SPEC** | G2、G4；§4、§4.4。                                                                                                                                                  |

**建议子计划文件名（示例）：** `2026-05-03-chat-db-first-layer-05-client-transport.md`

---

## Layer 6：收尾、删除旧路径与整体验收（横切）

| 项       | 内容                                                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标** | 删除死代码与误导入口（如 **`lib/ai/conversation-history-merge.ts`** 在无路用时）；**§8** 全勾选；按 **§9** 在 **全部实现与测试通过后** 再更新 `canvases/` 等人类文档。 |
| **做**   | 全局清理、测试全绿、文档/画布（时机遵守 §9）。                                                                                                                         |
| **不做** | 新功能扩张。                                                                                                                                                           |
| **依赖** | Layer 5 完成后的端到端行为。                                                                                                                                           |
| **SPEC** | §8、§9、§11。                                                                                                                                                          |

**建议子计划文件名（示例）：** `2026-05-03-chat-db-first-layer-06-cleanup-e2e.md`

---

## 每层结束定义（DoD）

- 与本层相关的 **`bun test`**（及仓库约定的 lint）通过。
- 本 Layer 表格中的 **SPEC 锚点** 有人对照勾选或在 PR 描述中逐条指向。

---

## 契约变更协议

若修改 **§4 HTTP body** 或 **`payload` 形状**：先改 **SPEC** 并在这份 RoadMap 的对应 Layer 记下「冻结点变更」；再改实现。避免静默漂移。

---

## 执行方式（后续）

对每个 **Layer**，单独会话使用 **`/writing-plans`**（或 `superpowers:writing-plans`）生成 **`2026-05-03-chat-db-first-layer-NN-*.md`**，内含 checkbox 任务与具体命令；**不要**在本 Harness 中展开逐步代码。

1. **Subagent-Driven（推荐）** — `superpowers:subagent-driven-development`，每子计划一代理、任务间评审。
2. **Inline Execution** — `superpowers:executing-plans`，同会话批量执行并设检查点。

---

## 修订记录

| 日期       | 摘要                                                              |
| ---------- | ----------------------------------------------------------------- |
| 2026-05-03 | 初版：六层 Harness、依赖顺序、DoD、契约变更协议、子计划命名示例。 |
