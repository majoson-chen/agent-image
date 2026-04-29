---
date: 2026-04-30
topic: conversation-list-actions-and-rename-tool
focus_hint: Sidebar 列表删除/重命名 + Agent 可调用「重命名当前对话」工具
status: ideation-complete
origin: grounded-in-repo
---

# 构思：对话列表删除 / 重命名 + Agent 重命名对话工具

面向本仓库：**agent-image**（Next.js App Router、侧边栏 `@/app/Sidebar.tsx`、对话 API `app/api/conversations/[id]`、工具编排 `lib/tools/tool-registry.ts`）。

## Phase 1 — Grounding（本仓库）

- **侧边栏：** `Sidebar` 服务端拉取对话，仅 `Link`，无选中态以外的操作入口。
- **删除：** `DELETE /api/conversations/[id]` 已实现（`handleDeleteConversation`），204。
- **重命名：** `lib/db/conversations.ts` 已有 `renameConversation(prisma, id, title)`，**未见**对等 `PATCH`/PUT Route Handler。
- **工具：** `buildAvailableTools(conversationId)` 挂载 web-search、image-search、web-fetch、生图工具；**无会话元数据类工具**。新工具需与其它工具一致注入 **`conversationId`**（无需 Agent 传入 id，符合 R17 与用户「当前聊天」语义）。

## 发散候选 — 多条思路（先于淘汰）

下列按六维框架粗分，条目可重叠。

### 1. Pain / friction

- **A.** 仅能点进会话才「间接」改名：无入口。
- **B.** 删对话只能靠删库或脚本：产品上缺失。

### 2. Inversion / removal / automation

- **C.** 双击标题就地 **inline rename**（减少对「弹窗表单」依赖）。
- **D.** 删除后自动跳转到列表中 **下一条**/最近一条——避免 404。
- **E.** 「重命名」先由 Agent **口述建议**，再在 UI 一键应用——多一份摩擦，不推荐作默认路径。

### 3. Reframe

- **F.** Sidebar 每项不是整行 `<Link>`，而是 **flex 行：`Link` 占剩余宽度 + icon button 区**——避免误触跳转。

### 4. Leverage（与后续）

- **G.** PATCH 与 Rename Tool **共用同一 server 校验**（长度、Unicode、Trim），防止 UI 与服务端分叉。
- **H.** Rename Tool 记入 **审计/消息时间线**：非必须；单机玩具可跳过。

### 5. Cross-domain

- **I.** 类 Cursor：**⋯ 菜单 + 快捷键**——后期再做。

### 6. Constraint flip

- **J.** 「Agent 自动生成标题不发工具」——单靠长文本不可靠；产品与 R15 类比：**显式可调用的工具更清晰**。
- **K.** 极小 schema：`rename_conversation(title)` **仅单行标题**，摘要由 Agent 在行内想好再传入。

## Critique — 否决与合并

| 条目 | 处理     | 理由                                                                     |
| ---- | -------- | ------------------------------------------------------------------------ |
| E    | ❌       | 与用户「提供 tool」目标不一致；可先保留产品后续「建议 + 一键确认」变种。 |
| H    | ❌ defer | scope 膨胀，无硬性需求。                                                 |
| I    | ❌ defer | Sidebar 已实现成本足够。                                                 |

**合并：** C 与 G 可同时存在（inline 编辑仍调同一 PATCH）。

## Survivors — 排名前 7（推荐给 ce-brainstorm / ce-plan）

1. **`PATCH /api/conversations/[id]`**
   Body：`{ title: string }`（或非空校验后的 `title`）；401/404 对齐现有 DELETE。作为 **单一事实来源** 供侧边栏 UI 与后续工具共用。

2. **Sidebar 行布局（F）**
    - 左侧可点击标题（`Link`，`truncate`，保持 daisyUI 语义色）。
    - 右侧 `btn btn-ghost btn-xs`：**重命名**（打开 modal 或唤起 inline）、**删除**（`modal`/`dialog` 二次确认，`daisyUI`）。
    - 当前会话路由下可用 `usePathname` 比对 `c.id` 给 `active`/`bg-base-300`（若当前为纯服务端 Sidebar，则需 **Client wrapper 若干行**——见风险）。

3. **删除后导航（D）**
   Client 组件里 `DELETE` 成功后：`router.refresh()`；若删掉的是当前 `conversationId`，则 `router.replace('/conversations/'+nextId)` 或落到「新建会话」占位页策略（需在 brainstorm 定下默认）。

4. **Agent 工具（K + G）**
    - **注册名：** 与现有 `web-search`、`image-fetch` 风格一致：`conversation-rename`（或 snake 形式以匹配 R8 内部名展示）。
    - **execute：** `renameConversation(prisma, conversationId, trimmedTitle)`，`conversationId` 由 `createConversationRenameTool({ conversationId })` 闭包捕获，**不向模型暴露可选 id**。
    - **inputSchema：** `z.object({ title: z.string().min(1).max(120) })`（上限可调）。
    - **needsApproval：** `false`（元数据写入，与用户资产一致；破坏性低于生图）。

5. **System prompt 增补**
   `lib/ai/system-prompt.ts` 在 `availableTools` 含 `conversation-rename` 时增加一句：可在适当时机根据会话主题建议短标题。**不强制**调用，以免抢答刷屏。

6. **RSC ↔ Client 切分建议**
    - `Sidebar.tsx` **保持**服务端 data fetch；将 `nav` 内 `map` **抽到** `'use client'` 的 `ConversationListItem`（或整段列表 client），仅为拿到 `pathname`/`router`。
    - 备选：服务端列表 + `[data-current]` 仅用 CSS：`body`/`layout` 传参——弱，不如 client 比对清晰。

7. **测试策略（对齐 AGENTS.md TDD）**
    - API：`PATCH` 成功、空标题 422、无权**若未来有 auth**。
    - 工具：**mock prisma** 或 route handler handler 导出测 `renameConversation` 被调用。**组件测**可选用 RTL 点菜单（若复杂度可控）。

### 备选（未进前七但可插队）

- **Inline rename（C）**：首版可用 **modal + input**（实现快、`aria` 清晰）；第二期换 contenteditable/input blur 提交。

## 风险与待定（交给 ce-brainstorm）

- 「当前对话」被删：**ChatPage/layout** 是否仍渲染已删 id——需 **`notFound`** 或与客户端删除联动。
- 重名标题：SQLite 无需唯一约束，产品可接受。
- Agent 是否与用户手写标题打架：**最后写入者优先**即可；无需 CRDT。

## 下一步路由

| 可选步骤          | 说明                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| **ce-brainstorm** | 把「PATCH + Sidebar 交互 + rename tool」写成 R 条与用户可见文案约定。 |
| **ce-plan**       | 拆分任务：`PATCH`、Sidebar 重构、tool、`system-prompt`、测试。        |

---

_本文件为 ce-ideate 产出，非需求冻结；落地以 ce-brainstorm / ce-plan / PR 为准。_
