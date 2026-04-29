---
title: feat：侧栏会话删除/重命名 + conversation-rename 工具
status: active
date: 2026-04-30
origin_requirements: docs/brainstorms/2026-04-30-conversation-sidebar-manage-requirements.md
---

# feat：侧栏会话删除/重命名 + conversation-rename 工具

## Requirements trace

| Req   | 实现要点                                                                |
| ----- | ----------------------------------------------------------------------- |
| R1–R5 | 侧栏每项：标题链接 + 重命名 / 删除；daisyUI modal + 语义色              |
| R2,R6 | 共享标题校验 `lib/validation/conversation-title.ts`（trim、1–120）      |
| R4    | 删当前会话：`router.replace` 至剩余首条或 `/`                           |
| R7–R9 | `conversation-rename` 工具闭包 `conversationId`，`needsApproval: false` |
| R10   | `system-prompt.ts` 非强制一句                                           |

## Implementation units

1. **Validation** — `conversation-title.ts`：`parseConversationTitle` / 常量导出。`renameConversation` DB 层假定入参已校验（由 route + tool 调用前校验）。

2. **API** — `app/api/conversations/[id]/route.ts`：`handlePatchConversation`，`PATCH`，422/404，复用校验。

3. **Tool** — `lib/tools/conversation-rename.ts`，`buildConversationRenameTool`，注册到 `tool-registry.ts`。

4. **System prompt** — 条件补充 `conversation-rename` 说明。

5. **UI** — `app/ConversationSidebarNav.tsx`（client）：接收 `conversations`；`dialog`+`modal-box` 重命名、`dialog` 删除确认；`usePathname`/`useRouter`；`router.refresh()`。

6. **Sidebar** — `Sidebar.tsx` 服务端取数后渲染 `ConversationSidebarNav`。

7. **Tests** — `tests/api/conversations.test.ts` 增加 PATCH；可选用 vitest 测 tool 或 chat 集成（最小：PATCH + 校验）。

## Deferred to implementation

- 无对话时删最后一条：跳转 `/`（`app/page.tsx` 已处理）。

## Verification

- `bun run lint` / `bunx tsc --noEmit` / `bun test`（或 vitest 全量）。

## Execution note

- API 行为：test-first PATCH 再 UI（与 AGENTS TDD 对齐时可先写失败用例）。
