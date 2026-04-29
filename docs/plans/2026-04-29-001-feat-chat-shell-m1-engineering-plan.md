---
title: "feat: agent-image M1 — 纯文本对话切片工程实现"
type: feat
status: active
date: 2026-04-29
origin: docs/brainstorms/2026-04-23-agent-image-requirements.md
plan_scope: engineering-m1
---

# feat: agent-image M1 — 纯文本对话切片工程实现

## 本计划边界（必读）

本计划是 v1 工程实现的 **M1 切片**：跑通「能纯文本对话」的最小可验收闭环——

- 用户可在设置页配置 **LLM 类型** Model（含 baseURL / Key / 上下文窗口）
- 用户可在对话页选定一个 LLM Model 后纯文本聊天
- 用户能看到上下文用量条按 **R6** 实时累计
- 用户能在窄侧栏切换 / 新建对话；切回旧对话时恢复持久化的 LLM 选择

**M1 不包括**（留 M2 / M3，由后续 `/ce-plan` 单独推进）：

- 生图 Model 与生图工具（M3 范围：R4, R5, R9, R15, R18）
- Search Model 与服务端工具集 web-search / image-search / web-fetch（M2 范围：R8, R12, R17）
- R15 生图确认闸（M3）
- R19 用户中断 / send-stop 同按钮（M2）
- R16 工具失败可视化（M2）
- R7 撞墙文本提示（M2，配合 R16）
- 任何 daisyUI 主题切换 UI（默认跟随 `prefers-color-scheme`）

---

## Overview

把仓库从「90% 空壳」推进到「能跑通 SPEC 中 R1-R3、R6、R10-R11、R14 文本部分的最小可验收切片」。具体交付：

- **Prisma schema 与首次迁移**：`Model` / `Conversation` / `Message` / `ConversationModelSelection` 四张表
- **设置页（仅 LLM 类型）**：`/settings` Server Component + 客户端表单 + Server Actions
- **对话页 shell**：`/chat/[id]` 主对话区 + LLM pill 选择器 + 用量条 + 输入区 + R3 LLM 必选门闸
- **服务端 LLM 通路**：`POST /api/chat` Route Handler with `streamText` + `toUIMessageStreamResponse` + provider 工厂
- **窄侧栏**：会话列表 / 新建 / 切换 / 设置入口
- **持久化与会话恢复**：会话切换时恢复 `ConversationModelSelection` 中的 LLM 选择

---

## Problem Frame

agent-image SPEC（origin）规定支持多厂商 LLM 多轮对话 + 工具可见 + 用量条 + 玩具级单机自用。仓库目前仅有 `app/layout.tsx` / `app/page.tsx` / `app/globals.css` + 空 Prisma schema，距离「能用」的产品有 0→1 距离。

直接做完整 v1（包含生图、Search、R15 闸、R19 中断）会让 plan 超大、难以验收，也不符合「玩具级 + 简单优先」基调。M1 把范围控制在「**纯文本聊天通路**」，验收标准明确：

- 配两个 LLM Model（如 OpenAI 与某 OpenAI-compatible 厂商）
- 在对话页切换、发送消息、看到 streaming 回复
- 用量条随对话累计
- 切到另一会话后再切回，原 LLM 选择被恢复

(see origin: `docs/brainstorms/2026-04-23-agent-image-requirements.md`)

---

## Requirements Trace

- R1. **玩具级实验性质** → M1 不做隔离 / 鉴权 / 加密；密钥明文落库（与 SPEC Key Decisions「密钥持久化」一致）
- R2. **多 Model**：每条 LLM Model 独立 baseURL + Key → U1 schema、U2 仓储、U3 设置页、U4 provider 工厂
- R3 **LLM 部分**：LLM 必选门闸（未选不发送）→ U6；持久化恢复 → U2 + U6 + U8（侧栏触发切换）
- R6. **上下文用量可视化**（仅用 API usage 累加，不做本地估算）→ U5（onFinish 落库）+ U7（用量条 UI）
- R10. **LLM Model 含 contextWindow 字段** → U1 + U2 + U3
- R11. **Prisma 持久化**（Model / Conversation / Message）→ U1
- R14 **文本部分**（意图内化由 Prompt） → 不写代码层管线；M1 留作 Prompt 责任，本 plan 不细化 system prompt 措辞

**Origin actors:** A1（终端用户）；A2（Agent，由 LLM 直接承担——M1 无工具循环，因此 A2 退化为「直接对话的 LLM」）

**Origin flows:** F1（配置 Model）部分覆盖（仅 LLM 类型字段，不含生图 / Search）；F2（对话与工具）部分覆盖（无工具，仅纯文本流）

**Origin acceptance examples:** AE1（多 Model 切换，仅 LLM 切换部分）；AE3（用量累计）；AE7（会话切换恢复，仅 LLM 部分）。AE2 / AE4 / AE5 / AE6 / AE8 / AE9 / AE10 / AE11 全部不在 M1 范围。

---

## Scope Boundaries

- 不实现 SPEC 中 R4 / R5 / R9 / R15 / R18（M3 范围）
- 不实现 SPEC 中 R7 / R8 / R12 / R16 / R17 / R19（M2 范围）
- 不做 Compact / 滑窗（与 SPEC R7 一致，永远 deferred）
- 不实现 daisyUI 主题切换 UI
- 不实现「切到不存在的 conversation id」的 404 优雅页面（M1 接受 Next 默认 not-found）

### Deferred to Follow-Up Work

- **M2 plan**：服务端工具集（web-search / image-search / web-fetch）+ Agent 工具循环 + R7 / R8 / R16 / R17 / R19；将基于本 plan 已交付的 Route Handler 与 ChatView 扩展，不重写
- **M3 plan**：生图 Model 完整支持 + R4 / R5 / R9 / R15 / R18；将基于本 plan 的 `Model` 表（已有 `type=IMAGE` 占位）与 `ConversationModelSelection`（已有 `IMAGE_PRIMARY` / `IMAGE_SECONDARY` 占位）扩展
- **设置页扩展**：M2 / M3 在 U3 基础上增加生图 / Search 子区段（同一 `/settings` 页面分 tab 或分块）
- **首篇 institutional learning**：M1 完成后可在 `docs/solutions/` 沉淀「AI SDK 6 + Next 16 流式聊天接入要点」（非本 plan 强制交付）

---

## Context & Research

### Tech Stack（锁定版本）

- **Next.js 16.2.4** + **React 19.2.5** + **TypeScript 6.x**（strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`）
- **AI SDK `ai@6.0.168`** 已装；`@ai-sdk/react` / `@ai-sdk/openai-compatible` / `@ai-sdk/openai` **均未装**（M1 安装清单见下）
- **Prisma 7.8.0** + `@prisma/adapter-better-sqlite3 7.8.0`，client 输出 `generated/prisma/`
- **Tailwind 4.2.4** + **daisyUI 5.5.19**（已就绪，含内置 light/dark 主题）
- **Vitest 4.1.5** + **`@testing-library/react` 16.3.2** + **jsdom 29**（已就绪，零样例）
- 包管理：**Bun**；路径别名：`@/* → ./app/*`（**lib/ 用相对路径** `../lib/...`）
- ESLint：`@antfu/eslint-config 8.2.0`，`indent=4 / semi=false / quotes='single'`

### M1 新增依赖（dependencies）

- `@ai-sdk/react`（提供 `useChat` hook）
- `@ai-sdk/openai-compatible`（最通用 fallback provider）
- `@ai-sdk/openai`（M1 内置类型枚举：`openai`）

### Relevant Code and Patterns

- `lib/cn.ts`：`cn(...inputs)` 已就绪（clsx + tailwind-merge），所有 className 拼接走它
- `lib/prisma.ts`：默认导出 `prisma`（`PrismaClient` from `../generated/prisma/client`）；当前 schema 空——U1 完成后即可用
- `prisma.config.ts`：`DATABASE_URL` 缺省 `file:./data.db`；`migrations.path = 'prisma/migrations'`
- `app/layout.tsx`：根布局已设 daisyUI + IBM Plex 字体；`<body>` 含 `bg-base-100 text-base-content antialiased`——M1 在此之上加 flex 布局塞入侧栏 + 主区
- `app/page.tsx`：当前 daisyUI 主题验证页，M1 重写为「重定向到最近 conversation 或新建一条空 conversation」

### Institutional Learnings

- `docs/solutions/`：**目录不存在**，零先例。M1 是仓库首批 TDD 与目录约定的奠基。

### External References

- **AI SDK Skill**：`.agents/skills/ai-sdk/SKILL.md`（含 v6.x 工具循环、`stopWhen`、UIMessage 协议）
- **Next 16 Skill**：`.agents/skills/next-best-practices/`（`route-handlers.md`、`rsc-boundaries.md`、`data-patterns.md`）
- **AI SDK 类型**：`node_modules/ai/dist/index.d.ts`（`streamText` / `LanguageModelUsage` / `OnFinishEvent` / `UIMessage` / `StreamTextResult` / `ChatOnFinishCallback`）
- **OpenAI-compatible provider**：`node_modules/@ai-sdk/openai-compatible/README.md`（实例化模式：`createOpenAICompatible({ baseURL, name, apiKey }).chatModel('model-id')`）
- **Prisma 规则**：`.cursor/rules/...migration-best-practices.mdc` 与 `schema-conventions.mdc`

---

## Key Technical Decisions

- **AI SDK Route Handler 形态**：`POST /api/chat`，服务端 `streamText(...).toUIMessageStreamResponse({ messageMetadata })`；客户端 `@ai-sdk/react` 的 `useChat` + `DefaultChatTransport`（from `ai`），**自管输入**（`useState` + `sendMessage({ text })`）。**不**用 `toDataStreamResponse`（已对 `useChat` 弃用）。
- **Provider 实例化**：per-request 实例化 `LanguageModel`，按 `Model.providerType` 分支 dispatch；M1 内置仅 `OPENAI` 与 `OPENAI_COMPATIBLE`，未覆盖统一 fallback 到 `OPENAI_COMPATIBLE`（与 SPEC Key Decisions「LLM 调用方式」一致）。**不缓存** instance。
- **usage 透传双轨**：服务端 `streamText` 的 `onFinish` 回调拿 `event.totalUsage` 写入 `Message` 表（**库为权威累计来源**）；同时通过 `toUIMessageStreamResponse({ messageMetadata })` 把当次 totalUsage 嵌入 UI 消息流（key=`finish` part），客户端读 `message.metadata.usage` 实时更新用量条。**绝对不依赖** `useChat` 的 `onFinish`（其类型不含 usage——研究确认的 pitfall）。
- **数据库实体（最小集）**：
    - `Model`：`type`（enum: `LLM | IMAGE | SEARCH`，M1 仅写入 `LLM`），`name`、`providerType`（enum: `OPENAI | OPENAI_COMPATIBLE`，M1 仅这两个）、`baseURL?`、`apiKey`、`contextWindow?`（LLM 类型 app 层强制非空）、`extraHeaders?` (Json)、`capabilities?` (Json)
    - `Conversation`：`id`、`title?`、时间戳
    - `Message`：`conversationId` (FK)、`role`（enum: `USER | ASSISTANT | SYSTEM`）、`content` (Text)、`usageInputTokens?` / `usageOutputTokens?` / `usageTotalTokens?`、`modelIdAtTime?` (FK to Model, on delete SET NULL)
    - `ConversationModelSelection`：`conversationId` (FK) × `role`（enum: `LLM | IMAGE_PRIMARY | IMAGE_SECONDARY`，M1 仅写 `LLM`）× `modelId` (FK)；UNIQUE(conversationId, role)
    - 后两个枚举值（`IMAGE` / `IMAGE_PRIMARY` / `IMAGE_SECONDARY`）为 M2/M3 占位，避免后续扩 schema
- **路由组织**：
    - `app/page.tsx`：server component，重定向到 `getMostRecent()?.id` 或新建一条空 conversation
    - `app/chat/[id]/page.tsx`：server component，SSR 拉取会话 + 历史消息 + selection + 可用 LLM 列表，注入 client `<ChatView>`
    - `app/settings/page.tsx`：server component，渲染 LLM 列表 + 表单
    - `app/api/chat/route.ts`：Route Handler（POST，流式）
- **会话恢复**：URL `chat/[id]` 是会话权威来源；`ConversationModelSelection` 表存当前会话三角色选择；server component SSR 注入初始 selection 到 `<ChatView>`，避免客户端首屏闪烁
- **TDD 纪律**：feature-bearing 单元（U1 schema CRUD、U2 仓储与校验、U4 provider 工厂、U5 Route Handler、U6 LLM 门闸交互、U7 用量计算）默认 **test-first**；U3 / U8 偏 UI 与脚手架，可放宽到「行为关键点测」（如 form 校验、sidebar 切换路由）。
- **Lint / Style**：所有新代码遵循 `eslint.config.ts` 的 @antfu 风格（4 空格缩进、无分号、单引号、JSX 启用）。

---

## Open Questions

### Resolved During Planning

- **usage 透传形态**：服务端 onFinish 落库 + messageMetadata 流双轨（见 Key Technical Decisions）
- **LLM provider 内置类型枚举**：M1 = `OPENAI` + `OPENAI_COMPATIBLE`；M2 / M3 视需要加 `ANTHROPIC` / `MOONSHOT` / `ALIBABA` 等
- **对话页路由形态**：`app/chat/[id]/page.tsx`（segment）+ `app/page.tsx` 做「最近会话或创建空会话」重定向
- **缺 usage 时的 UI**：累计停在最后已知值；用量条按 R6 显示中性占位（hover 不暗示真实数据）
- **`title` 自动生成**：M1 极简——`Conversation.title` 默认 null，UI 显示"新对话 + 时间"；M2 起再考虑首条消息自动总结

### Deferred to Implementation

- **`streamText` 的 `system` Prompt**：M1 用占位「你是 agent-image 的对话助手...」；R14 的 4 模式行为细化由后续 Prompt 迭代承担，不在本 plan 内
- **`messageMetadata` 字段命名**：服务端 + 客户端共一份 zod schema（在 `lib/ai/usage-metadata.ts`），具体字段如 `{ usage: { inputTokens, outputTokens, totalTokens } }` 在实现时定即可
- **`server-only` 包是否引入**：当前 `lib/ai/` 与 `lib/db/` 全部仅在 server 调用；实现时按 Skills 建议加 `import 'server-only'`，但本 plan 不强制
- **测试夹具策略**：内存 sqlite vs 临时文件 sqlite for prisma 单元测；按 vitest 体感选，确保测试间互不污染
- **Conversation 标题首条自动总结**：M1 不做，留 M2 视需要

---

## Output Structure

```text
app/
├── api/
│   └── chat/
│       └── route.ts                       [新建]
├── chat/
│   └── [id]/
│       ├── page.tsx                       [新建]
│       └── _components/
│           ├── chat-view.tsx              [新建, 'use client']
│           ├── model-pill.tsx             [新建, 'use client']
│           └── usage-ring.tsx             [新建, 'use client']
├── settings/
│   ├── page.tsx                           [新建]
│   ├── actions.ts                         [新建, 'use server']
│   └── _components/
│       ├── llm-model-form.tsx             [新建, 'use client']
│       └── llm-model-list.tsx             [新建, 'use client']
├── _components/
│   ├── conversation-sidebar.tsx           [新建, 'use client']
│   └── sidebar-actions.ts                 [新建, 'use server']
├── globals.css                            [保留]
├── layout.tsx                             [小修：插入侧栏 / 主区 flex 布局]
└── page.tsx                               [重写：重定向到最近 conversation]

lib/
├── ai/
│   ├── llm-provider.ts                    [新建]
│   └── usage-metadata.ts                  [新建]
├── db/
│   ├── models.ts                          [新建]
│   ├── conversations.ts                   [新建]
│   ├── messages.ts                        [新建]
│   └── selections.ts                      [新建]
├── validation/
│   └── llm-model-schema.ts                [新建]
├── cn.ts                                  [保留]
└── prisma.ts                              [保留]

prisma/
├── schema.prisma                          [大幅扩展]
└── migrations/
    └── <ts>_init/                         [新建（migrate dev 自动产出）]
```

> **注：** Output Structure 是 scope 声明而非约束；实现时若发现更合适的层级（如 `lib/ai/` 进一步细分），可调整。每单元的 `Files:` 才是各 unit 的权威边界。

---

## High-Level Technical Design

> _本节图示意 M1 数据 / 控制流，**是给 reviewer 验证方向的directional guidance，不是实现规格**。实现 agent 应当把它当 context、不要逐字对应代码。_

```mermaid
flowchart LR
    UI[ChatView 'use client']
    UC[useChat / DefaultChatTransport]
    RH["POST /api/chat<br/>Route Handler"]
    PF[lib/ai/llm-provider]
    ST[streamText]
    DB[(SQLite via Prisma)]
    ML[LLM API]

    UI -- sendMessage --> UC
    UC -- HTTP stream POST --> RH
    RH -- read Model+Messages --> DB
    RH --> PF
    PF -- LanguageModel --> ST
    ST --- ML
    ST -- stream parts --> RH
    RH -- toUIMessageStreamResponse<br/>+ messageMetadata{usage} --> UC
    UC --> UI
    ST -. onFinish .-> RH
    RH -. appendAssistantMessage<br/>(content + usage) .-> DB
    UI -. UsageRing reads<br/>message.metadata.usage .-> UI
```

**关键不变量**：

1. **库是 usage 累计的权威来源**（onFinish 写）；UI 即时显示靠 `messageMetadata` 流
2. **provider per-request 实例化**——多 Model 动态切换无状态
3. **server-only 模块仅由 Route Handler / server component / server action 调用**——绝不进 client bundle

---

## Implementation Units

- [ ] **U1. Prisma schema 与首次迁移**

**Goal:** 把空壳 schema 推进到 M1 所需的 4 张表 + 跑首次 `migrate dev`，让 `lib/prisma.ts` 真正可用。

**Requirements:** R2, R10, R11

**Dependencies:** 无

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_init/...`（migrate dev 自动产出）
- Test: `tests/prisma/schema.test.ts`

**Approach:**

- 实体定义（紧凑形态，最终 schema 由实现微调）：
    - `Model`：`id` (cuid)、`type` (enum `ModelType`: `LLM | IMAGE | SEARCH`)、`name`、`providerType` (enum `ProviderType`: `OPENAI | OPENAI_COMPATIBLE`)、`baseURL?`、`apiKey`、`contextWindow?`（LLM 必填由 app 层校验）、`extraHeaders?` (Json)、`capabilities?` (Json)、`createdAt`、`updatedAt`
    - `Conversation`：`id` (cuid)、`title?`、`createdAt`、`updatedAt`
    - `Message`：`id` (cuid)、`conversationId` (FK to Conversation, on delete CASCADE)、`role` (enum `MessageRole`: `USER | ASSISTANT | SYSTEM`)、`content` (Text)、`usageInputTokens?`、`usageOutputTokens?`、`usageTotalTokens?`、`modelIdAtTime?` (FK to Model, on delete SET NULL)、`createdAt`
    - `ConversationModelSelection`：`id` (cuid)、`conversationId` (FK on delete CASCADE)、`role` (enum `SelectionRole`: `LLM | IMAGE_PRIMARY | IMAGE_SECONDARY`)、`modelId` (FK on delete CASCADE)、`createdAt`；UNIQUE(`conversationId`, `role`)
- 跑首次迁移：`bun --bun run prisma migrate dev --name init`（命令仅作 verification 锚，不进 plan 测试断言）

**Execution note:** characterization-first — 先写 schema 测试断言"4 表、关键约束、级联策略"，再 generate + migrate；测试用临时文件 sqlite 隔离，跑完 cleanup。

**Patterns to follow:**

- 现有 generator/datasource 块（`generator client { provider="prisma-client", output="../generated/prisma" }` + `datasource db { provider="sqlite" }`）保留
- 模型命名 PascalCase、字段 camelCase、enum PascalCase（按 schema-conventions.mdc）

**Test scenarios:**

- Happy path: 新建 Model（`type=LLM`, `providerType=OPENAI`）→ 新建 Conversation → 新建 Selection（`role=LLM`, `modelId`）→ 新建 Message（`role=USER`）+ 新建 Message（`role=ASSISTANT, usage*`）→ 关联查询拿回完整对话
- Edge case: 同一 Conversation 同一 role 二次 create Selection → 抛 unique 约束错误
- Edge case: `Conversation.delete` → 级联删除其所有 Messages 与 Selections
- Edge case: `Model.delete` → 关联 Message 的 `modelIdAtTime` 被设为 null（保历史 usage）
- Edge case: `ConversationModelSelection` 引用的 Model 被删 → Selection 一并被删（保选择一致性）
- Error path: Message.role 字段写入非 enum 值 → Prisma 抛错

**Verification:**

- `bun --bun run prisma migrate status` 显示 init 已应用
- `prisma/migrations/<ts>_init/migration.sql` 存在且包含 4 张表 + 4 个 enum
- 上述测试 scenarios 全部通过

---

- [ ] **U2. 服务端仓储层 + zod 校验**

**Goal:** 在 `lib/db/` 与 `lib/validation/` 提供 Model / Conversation / Message / Selection 的最小 CRUD + 输入校验，作为 Route Handler 与 server components 的统一访问层。

**Requirements:** R2, R10, R11

**Dependencies:** U1

**Files:**

- Create: `lib/db/models.ts`、`lib/db/conversations.ts`、`lib/db/messages.ts`、`lib/db/selections.ts`
- Create: `lib/validation/llm-model-schema.ts`
- Test: `lib/db/models.test.ts`、`lib/db/conversations.test.ts`、`lib/db/messages.test.ts`、`lib/db/selections.test.ts`、`lib/validation/llm-model-schema.test.ts`

**Approach:**

- `lib/db/models.ts`：`listModels(type?)`、`getModel(id)`、`createLlmModel(input)`、`updateLlmModel(id, patch)`、`deleteModel(id)`
- `lib/db/conversations.ts`：`listConversations()`、`getConversation(id)`、`createConversation(title?)`、`renameConversation(id, title)`、`deleteConversation(id)`、`getMostRecent()`
- `lib/db/messages.ts`：`listMessages(conversationId)`、`appendUserMessage(conversationId, content)`、`appendAssistantMessage(conversationId, content, usage, modelIdAtTime)`、`aggregateUsage(conversationId)` → `{ inputTokens, outputTokens, totalTokens } | null`
- `lib/db/selections.ts`：`getSelection(conversationId, role)`、`setSelection(conversationId, role, modelId)`（upsert）、`getAllSelections(conversationId)` → `{ LLM?, IMAGE_PRIMARY?, IMAGE_SECONDARY? }`
- `lib/validation/llm-model-schema.ts`：zod schema for `LlmModelInput`：必填 `name` (非空字符串)、`providerType`（enum 字面量）、`apiKey`（非空字符串）、`contextWindow`（正整数）；可选 `baseURL`（URL 格式校验，`providerType=OPENAI_COMPATIBLE` 时 superRefine 强制非空）、`extraHeaders`（`Record<string, string>`）、`capabilities`（任意 record）

**Execution note:** test-first（CRUD 行为、聚合公式、空态返回、zod 边界）

**Patterns to follow:**

- 全 named export（参考 `lib/cn.ts` 风格）
- 所有 db 模块 `import prisma from '../prisma'`（lib/ 不在路径别名内）
- 类型派生：`type LlmModelInput = z.infer<typeof llmModelInputSchema>`，单一来源

**Test scenarios:**

- Happy path: `createLlmModel` 合法字段 → `getModel` 拿回相同；`listModels('LLM')` 包含
- Happy path: `appendUserMessage` + `appendAssistantMessage(content, usage, modelId)` → `aggregateUsage` 返回 sum；不同 conversation 互不影响
- Edge case: `aggregateUsage(空 conversation)` → null
- Edge case: `aggregateUsage(部分消息缺 usage)` → 仅累计有 usage 的消息
- Edge case: `setSelection` 重复 role upsert 替换前值
- Edge case: `getMostRecent()` 在空库返回 null
- Error path: `createLlmModel({ apiKey: '' })` → zod 校验失败抛错
- Error path: `createLlmModel({ contextWindow: 0 })` → zod 校验失败
- Error path: `createLlmModel({ providerType: 'OPENAI_COMPATIBLE', baseURL: undefined })` → zod superRefine 失败

**Verification:**

- 所有 db 测试通过；类型层 `LlmModelInput` 为 zod 推断（不重复定义）；`generated/prisma` 类型在 IDE 中可被识别

---

- [ ] **U3. 设置页（仅 LLM 类型）**

**Goal:** 用户能在 `/settings` 列出已有 LLM Model、新增、编辑、删除一条 LLM Model；提交即落库；同页内（M1 设置页仅 LLM 区块，预留扩展位）。

**Requirements:** R2, R10, R11

**Dependencies:** U2

**Files:**

- Create: `app/settings/page.tsx`
- Create: `app/settings/actions.ts`（'use server'：`createLlmModelAction`、`updateLlmModelAction`、`deleteLlmModelAction`）
- Create: `app/settings/_components/llm-model-form.tsx`（'use client'）
- Create: `app/settings/_components/llm-model-list.tsx`（'use client'）
- Test: `app/settings/_components/llm-model-form.test.tsx`、`app/settings/actions.test.ts`

**Approach:**

- `page.tsx`（server）：`await listModels('LLM')` → 渲染 `<LlmModelList models={...} />` + "新增 LLM" 按钮触发 `<LlmModelForm mode="create" />`
- 表单字段：`name`、`providerType`（select: `OPENAI` / `OPENAI_COMPATIBLE`）、`baseURL`（仅 `OPENAI_COMPATIBLE` 时显示且必填）、`apiKey`（password input）、`contextWindow`（number input，单位 tokens）
- daisyUI 表单类（`form-control` / `input` / `select` / `btn-primary` / `btn-error` 等）+ 中文文案
- React 19 Server Actions：`'use server'` 文件中调 zod safeParse → `createLlmModel(...)` → `revalidatePath('/settings')`
- 错误处理：用 `useActionState` 把 `safeParse.error` 回显到表单内联错误（`text-error` + `text-sm`）

**Patterns to follow:**

- daisyUI 语义色（绝不裸 hex / `bg-green-500`）
- `cn()` 拼条件类名
- 设计 plan §1 Visual thesis：操作台气质、信息密度中等

**Test scenarios:**

- Happy path: 表单填合法字段 → 提交 → action 调 createLlmModel → list 多出一条
- Happy path: 编辑现有 Model → updateLlmModelAction 调 updateLlmModel → 刷新数据
- Happy path: 删除 Model → deleteLlmModelAction → 刷新数据
- Edge case: `providerType` 切换到 `OPENAI_COMPATIBLE` 后 baseURL 字段变必填且显示
- Edge case: `providerType=OPENAI` 时 baseURL 字段隐藏（避免误填）
- Error path: `contextWindow` 输入 0 / 负数 / 非数字 → 表单 inline 错误回显
- Error path: `apiKey` 留空 → 表单 inline 错误回显
- Error path: 后端 createLlmModel 抛错 → action 返回错误状态 → UI 显示

**Verification:**

- 浏览器走查：在 `/settings` 完整 CRUD 一条 OpenAI 兼容 LLM Model；刷新后数据保留

---

- [ ] **U4. 服务端 LLM Provider 工厂**

**Goal:** 给定 Model record，per-request 返回 AI SDK `LanguageModel` 实例，供 Route Handler 喂入 `streamText`。

**Requirements:** R2

**Dependencies:** U2（Model record 类型来源）

**Files:**

- Create: `lib/ai/llm-provider.ts`
- Test: `lib/ai/llm-provider.test.ts`

**Approach:**

- 文件首行 `import 'server-only'`
- 函数签名（紧凑伪代码，**directional**）：

```text
function createLlmModelInstance(record: ModelRecord): LanguageModel
  switch record.providerType
    case 'OPENAI':
      return createOpenAI({ apiKey, baseURL? }).chat(record.name)
    case 'OPENAI_COMPATIBLE':
      assert record.baseURL else throw LlmProviderError
      return createOpenAICompatible({ baseURL, name: record.providerType, apiKey }).chatModel(record.name)
    default:
      // SPEC Key Decisions「未覆盖统一 fallback openai-compatible」
      same as OPENAI_COMPATIBLE branch
```

- 自定义错误：`class LlmProviderError extends Error`（含 `cause` 字段记 record.id 但**不含 apiKey**）
- 不缓存任何实例；不在日志、错误消息、堆栈中泄露 `apiKey`

**Execution note:** test-first — 先写 mock record → 期望返回类型与方法存在性

**Patterns to follow:**

- 严格的 `import` 风格（命名导入）；ESM-only

**Test scenarios:**

- Happy path: `providerType=OPENAI`、`name='gpt-4o'`、`apiKey='sk-...'` → 返回 LanguageModel 形态对象（断言关键字段或方法存在）
- Happy path: `providerType=OPENAI_COMPATIBLE`、`baseURL='https://api.moonshot.cn/v1'`、`name='moonshot-v1-32k'` → 返回非空对象
- Edge case: 未知 `providerType` → fallback 走 `OPENAI_COMPATIBLE` 路径（前提 baseURL 存在）
- Edge case: `providerType=OPENAI`，`baseURL` 提供 → 透传到 `createOpenAI({ baseURL })`（自定义 endpoint 场景）
- Error path: `providerType=OPENAI_COMPATIBLE` 但 `baseURL` 缺失 → 抛 `LlmProviderError`，message 不含 apiKey
- Error path: `apiKey` 空字符串 → 抛 `LlmProviderError`（M1 早 fail）

**Verification:**

- 单测通过；测试中无任何外部网络调用（仅构造实例）；apiKey 不出现在 stack trace 或错误消息

---

- [ ] **U5. 聊天 Route Handler**

**Goal:** `POST /api/chat` 接收 `{ conversationId, modelId, messages }`，从库读 Model + 既有 Messages，构造 LanguageModel，`streamText` 流回响应；`onFinish` 时落库 assistant message + usage；通过 `messageMetadata` 把 totalUsage 嵌入 UI 流。

**Requirements:** R2, R6, R10, R11, R14（文本部分）

**Dependencies:** U2, U4

**Files:**

- Create: `app/api/chat/route.ts`
- Create: `lib/ai/usage-metadata.ts`（zod schema：`{ usage: { inputTokens, outputTokens, totalTokens } }`）
- Test: `app/api/chat/route.test.ts`、`lib/ai/usage-metadata.test.ts`

**Approach:**

- `import 'server-only'`
- POST handler 流程（**directional 伪代码**）：

```text
POST(req):
  body = await req.json()
  parsed = chatRequestSchema.safeParse(body)  // zod: conversationId, modelId, messages
  if !parsed → return Response.json({ error }, 400)
  model = await getModel(parsed.modelId)
  if !model → return Response.json({ error: 'model not found' }, 404)
  history = await listMessages(parsed.conversationId)
  llm = createLlmModelInstance(model)
  result = streamText({
    model: llm,
    system: '<<占位 system prompt>>',
    messages: convertToModelMessages([...history.asUI, ...parsed.messages]),
    onFinish: async (event) => {
      await appendAssistantMessage(
        parsed.conversationId,
        event.text,
        { inputTokens: event.totalUsage.inputTokens,
          outputTokens: event.totalUsage.outputTokens,
          totalTokens: event.totalUsage.totalTokens },
        model.id
      )
    }
  })
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) =>
      part.type === 'finish'
        ? { usage: extractUsage(part) }
        : undefined
  })
```

- usage 累计在 `onFinish` 落库（**库为权威**）；`messageMetadata` 仅供 UI 即时展示
- `lib/ai/usage-metadata.ts`：导出 `usageMetadataSchema` 与 `type UsageMetadata`，client / server 共用
- M1 错误处理：`onFinish` 内异常 → 仅 `console.error` 记录 + 不落库；流仍返回客户端（用户看到 assistant 文本但 DB 少一条）。M2 接 R16 时再扩展为「失败可视化 + 重试」

**Execution note:** test-first — 先写 handler 集成测：mock streamText 验证请求体校验、onFinish 写库、messageMetadata 形态

**Patterns to follow:**

- Route Handler 模式参考 `.agents/skills/next-best-practices/route-handlers.md`
- zod 输入 schema 与 `usage-metadata.ts` 一致

**Test scenarios:**

- Happy path: 合法 body → handler 调 createLlmModelInstance + streamText（mock）→ onFinish 触发 → appendAssistantMessage 被调用，参数含 totalUsage
- Edge case: messages 为空数组 → streamText 仍发起；onFinish usage 字段任意为 undefined → appendAssistantMessage 用 null 填字段
- Edge case: messageMetadata 函数对非 finish part 返回 undefined（不污染流）
- Edge case: `extractUsage(part)` 在 part.totalUsage 缺失时返回 null usage 字段
- Error path: body schema 校验失败 → 返回 400 + 错误消息
- Error path: getModel 返回 null → 返回 404
- Error path: createLlmModelInstance 抛 LlmProviderError → 返回 500 + 错误消息（不含 apiKey）
- Integration: 用 AI SDK 的 `MockLanguageModelV3`（或类似测试 helper）跑端到端 → onFinish 写库 → DB 中 message + usage 完整、UI 流中 finish part 含 messageMetadata

**Verification:**

- 集成测通过；手测 `curl POST /api/chat` 配合一个真实 LLM Model 能拿到流（开发期人工 verification）

---

- [ ] **U6. 对话页 shell + useChat 接入 + R3 LLM 必选门闸**

**Goal:** `app/chat/[id]/page.tsx` 渲染主对话区；client `<ChatView>` 用 `@ai-sdk/react` 的 `useChat` + `DefaultChatTransport` 接 `/api/chat`；输入区根据 LLM 选择状态决定可用性。

**Requirements:** R3（LLM 部分）, R14（文本部分）

**Dependencies:** U2（selections / messages / models）, U5

**Files:**

- Create: `app/chat/[id]/page.tsx`
- Create: `app/chat/[id]/_components/chat-view.tsx`（'use client'）
- Create: `app/chat/[id]/_components/model-pill.tsx`（'use client'）
- Modify: `app/page.tsx`（重写为重定向）
- Test: `app/chat/[id]/_components/chat-view.test.tsx`、`app/chat/[id]/_components/model-pill.test.tsx`、`app/page.test.tsx`

**Approach:**

- `app/chat/[id]/page.tsx`（server）：`{ params }: { params: Promise<{ id: string }> }` → `await params` 拿 id（Next 16 异步 params）→ 并行 SSR 拉 `getConversation(id)` / `listMessages(id)` / `getAllSelections(id)` / `listModels('LLM')` → 渲染 `<ChatView />` 注入初值
- `app/page.tsx`（server）：`const recent = await getMostRecent(); redirect(\`/chat/${recent?.id ?? (await createConversation()).id}\`)`
- `<ChatView>`：

```text
const transport = useMemo(() =>
  new DefaultChatTransport({
    api: '/api/chat',
    body: () => ({ conversationId, modelId: selectedLlmId })
  }), [conversationId, selectedLlmId])

const { messages, sendMessage, status } = useChat({
  id: conversationId,
  messages: initialMessages,
  transport,
})

const [input, setInput] = useState('')
const canSend = !!selectedLlmId && status !== 'submitted' && input.trim().length > 0
const onSubmit = (e) => { e.preventDefault(); sendMessage({ text: input }); setInput('') }
```

- `<ModelPill>`：弹层（daisyUI dropdown）选择 LLM；选中触发 server action `setSelection(conversationId, 'LLM', modelId)` + 客户端状态同步；显示当前选中 Model 的 name
- 输入区禁用规则：`!selectedLlmId` → `<button disabled>` + 一行提示"请先选定 LLM"；附带链接到 `/settings` 当 `availableLlmModels.length === 0`
- 文本左对齐（与设计 plan §3 一致）：user 用 `bg-base-200`，assistant 用 `bg-base-300`，等宽字体的工具相关元素 M1 用不上（无工具）
- 流式渲染：`useChat.messages` 中 part-by-part 拼接 `text-delta` parts

**Execution note:** test-first（关键交互：禁用 / 启用 / 提交 / 切 Model）

**Patterns to follow:**

- daisyUI 语义色 + `cn()`
- `'use client'` 仅在交互子组件
- React 19 `useActionState` 处理 server action 错误

**Test scenarios:**

- Covers AE1（部分）: 切换 LLM Model 后下一次 `sendMessage` body.modelId 改变（mock transport 验证）
- Happy path: 未选 LLM → 输入区 / 发送按钮禁用；提示文案可见
- Happy path: 选定 LLM → 启用；输入文字后 Enter / 点发送 → `useChat.sendMessage` 被调用，body 含 modelId 与 conversationId
- Happy path: useChat.messages 流式更新 → assistant 气泡逐字渲染（用 mock transport stream）
- Edge case: 切回上一对话（不同 id）→ initialSelection 注入 → ModelPill 显示历史 LLM
- Edge case: availableLlmModels 为空 → ModelPill 显示"请先到 /settings 添加 LLM"，链接可点
- Edge case: 切换 LLM 时正在流式中 → 当前流不中断（M1 接受），下一次 send 用新 modelId
- Error path: useChat.error 非空 → ChatView 顶部显示 daisyUI alert
- Integration: 真实 streamText（用 AI SDK mock model）流式回传 → ChatView 完整渲染对话

**Verification:**

- 浏览器走查：`/chat/<id>` 完整发送 + 接收一轮 + 切换 Model + 切到另一会话再切回看到选择保留

---

- [ ] **U7. 上下文用量条 + R6 累计渲染**

**Goal:** 在对话页输入区上方渲染圆环用量条；首屏从 server-side `aggregateUsage(conversationId)` + 当前 LLM 的 `contextWindow` 注入；流式新消息通过 `message.metadata.usage` 实时累加；缺数据时显示中性占位。

**Requirements:** R6, R10

**Dependencies:** U2（aggregateUsage）, U5（messageMetadata）, U6

**Files:**

- Create: `app/chat/[id]/_components/usage-ring.tsx`（'use client'）
- Modify: `app/chat/[id]/page.tsx`（server 拉 `accumulatedTotalTokens` 初值与 `contextWindow` 传给 ChatView）
- Modify: `app/chat/[id]/_components/chat-view.tsx`（订阅 `useChat.messages` 末尾的 `message.metadata.usage`，累加到本地 state）
- Test: `app/chat/[id]/_components/usage-ring.test.tsx`、`app/chat/[id]/_components/chat-view.usage.test.tsx`（用量累加路径）

**Approach:**

- props（紧凑伪类型）：`{ accumulatedTotalTokens: number | null, contextWindow: number | null }`
- 比例计算：`null` → 中性 0% 占位；否则 `Math.min(1, accumulated / contextWindow)`
- 渲染：内联 SVG 圆环（不引第三方）；hover 用 daisyUI tooltip 显示 `${pct}% · ${total/1000}k / ${cw/1000}k context usage`
- 中性占位 hover 文案：「暂无可用累计」类（**不**显示 `0% · 0 / Nk` 这种暗示真实数据的 0 值文案）
- ChatView 内累加：`const [streamUsage, setStreamUsage] = useState(0)`；监听 `messages` 末位 message.metadata.usage 变化时累加 `totalTokens`
- 总展示值：`accumulatedTotalTokens + streamUsage`
- 当 `selectedLlmId` 切换到不同 contextWindow 的 Model：UsageRing 的 `contextWindow` prop 同步更新（视觉重算）

**Patterns to follow:**

- SVG 圆环 width=2, viewBox=0 0 32 32 类的小尺寸（与 SPEC「外径对齐 pill 内文字行高」一致）
- daisyUI `tooltip tooltip-bottom`

**Test scenarios:**

- Happy path: `contextWindow=200000`、`accumulatedTotalTokens=10000` → 渲染 5% 圆环；hover 文案对应（用 `@testing-library/user-event` 触发 hover）
- Edge case: `accumulatedTotalTokens=null` → 中性 0% 占位；hover 文案不冒充真实数据
- Edge case: `contextWindow=null`（未选 LLM）→ 圆环不显（与 R6 「无数据则不显」一致；或 0% 占位，二选一并测试断言一致）
- Edge case: `accumulatedTotalTokens > contextWindow` → 比例锁 100%（不溢出 UI）
- Edge case: 流式新消息 metadata.usage.totalTokens=500 → streamUsage 增加 500，UsageRing 显示更新后的累计
- Edge case: 流式消息 metadata 缺 usage（part.totalUsage undefined）→ streamUsage 不变
- Integration: ChatView 收到带 metadata.usage 的新消息 → UsageRing prop 更新 → 视觉变化（jsdom 下用 RTL 验证）

**Verification:**

- 浏览器走查：发送多条消息后用量条逐次上升；切 Model 后基数与窗口同步变化；缺 usage 的消息不让圆环跳变

---

- [ ] **U8. 会话列表 + 新建 / 切换（窄侧栏）**

**Goal:** 左侧窄侧栏列出已有 Conversation；可新建空 conversation；可切换；点击 settings 入口跳 `/settings`。

**Requirements:** R3（持久化恢复部分需要切换入口）, R11

**Dependencies:** U2（conversations CRUD）, U6（chat/[id] 路由就绪）

**Files:**

- Create: `app/_components/conversation-sidebar.tsx`（'use client'）
- Create: `app/_components/sidebar-actions.ts`（'use server'：`createConversationAction`、`deleteConversationAction`）
- Modify: `app/layout.tsx`（在 body 内加 flex 布局：`<aside>` 侧栏 + `<main>{children}</main>`）
- Test: `app/_components/conversation-sidebar.test.tsx`

**Approach:**

- `app/layout.tsx` 改造：在 `<body>` 中加 flex；`<aside class="w-64 bg-base-200 ...">` 渲染 server-fetched 列表 + `<ConversationSidebar conversations={...} />`（client 子组件处理选中态与交互）
- `<ConversationSidebar>`：用 `usePathname()` 取当前 URL → 比对 conversation.id 高亮（`bg-base-300`）；点击 item 用 `<Link>` 跳 `/chat/<id>`
- 新建按钮 → `createConversationAction` server action → 内部 `await createConversation()` + `revalidatePath('/')` + `redirect(/chat/<newId>)`
- 删除（M1 极简）：每条 conversation 右侧 hover 显示 `🗑` → 弹原生 `confirm()` → `deleteConversationAction` → revalidate
- 设置入口：侧栏底部 `<Link href="/settings">⚙ 设置</Link>`

**Patterns to follow:**

- daisyUI `menu` 组件类（`menu menu-vertical`）
- Next 16 `'use server'` + `revalidatePath` + `redirect`
- `cn()` 拼条件类

**Test scenarios:**

- Happy path: 新建按钮 → action 调 createConversation → revalidate + 跳新会话（mock router 断言）
- Happy path: 点击已有会话 → URL 切换 + 选中态高亮（usePathname mock 验证）
- Happy path: 列表按 `updatedAt desc` 排序
- Edge case: 列表空 → 显示"暂无对话，点击新建开始"占位 + 新建按钮仍可用
- Edge case: 当前会话被删除 → revalidate 后 sidebar 不再显示该项；URL 已失效但 M1 接受 Next 默认行为（不主动 redirect）
- Error path: 删除失败（FK 约束等罕见）→ inline alert / toast（M1 极简：alert + console.error）

**Verification:**

- 浏览器走查：能新建多个对话、切换、URL 与列表选中态同步；侧栏在窄屏下 M1 接受默认折叠（响应式细化留 M2）

---

## System-Wide Impact

- **Interaction graph:** ChatView ↔ useChat ↔ `/api/chat` → streamText → LLM API → onFinish → DB；同步 messageMetadata 到 ChatView → UsageRing 重渲染。Sidebar 的 server actions 触发 `revalidatePath` 导致 layout server component 重新拉 conversation 列表。
- **Error propagation:** Route Handler 内异常 → 返回 4xx/5xx + JSON `{ error }`；客户端 `useChat` 自动暴露 error；UI 通过 daisyUI alert 渲染。streamText 中流断 → useChat 内部状态切到 error；M1 不做自动重试（M2 接 R16 时再扩展）。Server actions 异常 → 通过 `useActionState` 返回的 state 携带错误回显在 UI inline。
- **State lifecycle risks:** `onFinish` 写库与流式回传是异步并发——客户端可能比库更新更早渲染 assistant 气泡；M1 接受（库会在毫秒后追上）。极端情况 `onFinish` 失败 → 库少一条 assistant message → 用户刷新页面会丢这条；M2 修。**`Conversation.delete` 级联**会清空所有 messages 与 selections——可逆性 0；M1 接受（玩具级；用户原生 confirm 兜底）。
- **API surface parity:** 仅一个 Route Handler `/api/chat`；server actions 散布在 `app/settings/actions.ts` 与 `app/_components/sidebar-actions.ts`；每条都有 zod 输入校验。
- **Integration coverage:** U5 的 Route Handler 测必须用真实 streamText（用 AI SDK 测试 helper 如 `MockLanguageModelV3`）跑通端到端流，因为 onFinish 时机与 messageMetadata 嵌入 part 的语义只能在真实 SDK 路径中验证。
- **Unchanged invariants:**
    - R7（不做 compact / 滑窗）——M1 / M2 / M3 全程不动
    - R1（玩具级，不加密）——明文落库
    - SPEC 术语「Model」一以贯之，代码中绝不引入 `Provider` 字面（除了 `providerType` 这个具体字段名，与 SPEC Key Decisions 兼容）
    - `lib/cn.ts` / `lib/prisma.ts` / `app/layout.tsx` 字体设置 / `app/globals.css` 主题块**不修改**（只在 layout.tsx 加 flex 容器）
    - `prisma.config.ts` 不动

---

## Risks & Dependencies

| 风险                                                                           | 缓解                                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `useChat` 的 `onFinish` 不含 usage（已确认 pitfall）                           | Key Decision 已锁"messageMetadata + 服务端 onFinish 落库"双轨；U5/U6/U7 一致；测试覆盖                                                |
| `streamText` 与 `useChat` 协议不兼容（误用 `toDataStreamResponse`）            | 已锁 `toUIMessageStreamResponse`；U5 集成测验证 finish part metadata 形态                                                             |
| Per-request provider 实例化在并发下耗时                                        | 玩具级 + 单机自用，并发 ≤ 1，可接受；不缓存反而避免 Key 轮换问题                                                                      |
| Prisma 7 + better-sqlite3 adapter 与 Next 16 RSC 边界冲突                      | `lib/prisma.ts` 已用 globalThis 单例 + adapter；M1 不在 client 触发 prisma（全部走 server component / Route Handler / server action） |
| 测试夹具污染：vitest 多 spec 共享 sqlite 文件                                  | 实现时用临时文件 sqlite per test file 或 in-memory；具体方式 deferred to implementation                                               |
| `@ai-sdk/openai-compatible` 版本与 `ai@6.0.168` 不匹配                         | 安装时同 minor 跟随；U4 测试断言函数返回的 LanguageModel 形态                                                                         |
| Next 16 `params` 已经异步（`await params`）                                    | 所有 server component 路径（`chat/[id]/page.tsx`）使用 `params: Promise<...>`；U6 单测覆盖                                            |
| `IMAGE_PRIMARY` / `IMAGE_SECONDARY` 占位 enum 在 M1 永不写入但占用 schema 空间 | 接受——避免后续扩 schema 引发迁移；M2/M3 直接用，无需 alter table                                                                      |

---

## Documentation / Operational Notes

- 本 plan 完成后 `docs/solutions/` 仍为空；M1 完成后**建议**补一篇「AI SDK 6 + Next 16 流式聊天接入要点」作为首篇 institutional learning（涉及 useChat onFinish pitfall、messageMetadata 透传、provider per-request 模式）——非本 plan 强制交付，留给 ce-compound 触发
- M2 plan 的 origin 仍是同一份 SPEC；M2 启动时只需读 SPEC + 读本 plan「Deferred to Follow-Up Work」节看 M1 已交付边界
- 无 deployment / monitoring 影响（玩具级，本地 `bun dev`）
- `data.db` 已在 `.gitignore`；`prisma/migrations/` **应该提交**（按 prisma 最佳实践）

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-agent-image-requirements.md](../brainstorms/2026-04-23-agent-image-requirements.md)
- **Playbook（推荐性）:** [docs/brainstorms/2026-04-23-agent-image-agent-playbook.md](../brainstorms/2026-04-23-agent-image-agent-playbook.md)
- **设计 plan（含设计稿用色）:** [docs/plans/2026-04-23-001-feat-chat-ui-shell-plan.md](./2026-04-23-001-feat-chat-ui-shell-plan.md)
- **协作说明:** [AGENTS.md](../../AGENTS.md)
- **Skills:** `.agents/skills/ai-sdk/SKILL.md`、`.agents/skills/next-best-practices/`
- **AI SDK types:** `node_modules/ai/dist/index.d.ts`
- **OpenAI compatible provider:** `node_modules/@ai-sdk/openai-compatible/README.md`
- **Prisma 规则:** `.cursor/plugins/cache/cursor-public/prisma/.../rules/migration-best-practices.mdc`、`schema-conventions.mdc`
