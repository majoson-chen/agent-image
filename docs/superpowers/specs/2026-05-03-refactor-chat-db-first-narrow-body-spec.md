# SPEC：聊天 API —— DB 唯一事实源 + 窄请求体

## 文档状态

- **类型**：实现前需求 / 架构 SPEC（汇总对话结论，供计划拆分与评审）。
- **产品定位**：`agent-image` 为单机自用 **Toy**；正确性与可推理性优先于极致通用化。
- **与现有代码关系**：当前 `app/api/chat/route.ts` 仍以 **客户端 `messages` 与 DB 合并构图**、`prepareStep` 单流注入为主；本 SPEC 描述 **目标态**。迁移时可分多计划落地。

---

## 1. 背景与动机

1. **单一真相源**：会话历史以 **DB 中的 Message 记录** 为构图与展示主源；避免「客户端整包历史 + DB」双源合并带来的错位、时序与维护成本（如 `mergeClientMessagesWithDbForModel` 类逻辑）。
2. **窄请求体**：POST `/api/chat` 只携带 **对本轮服务端行为有增量价值** 的字段（用户本轮输入，或工具审批结果等）。**省流量与时间**是附带收益；核心目的是 **减少无关客户端状态进入服务端**，避免因多余字段产生副作用或错误合并。
3. **与 AI SDK 对齐**：继续使用 **`ToolLoopAgent`**、UI 消息流响应；客户端继续使用 **`useChat` + `DefaultChatTransport`**。收窄 body 在 **`prepareSendMessagesRequest`** 中完成（SDK 入参中虽有完整内存 `messages`，HTTP 层只发出过滤后的 JSON）。

---

## 2. 目标（目标态必须满足）

| ID  | 陈述                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | 服务端构造 **发往模型的 UI / model 消息列表** 时，**默认**仅依赖 **`listMessages(DB)` + 本次请求载荷**；不因「客户端附带整段历史」而覆盖 DB 事实。                                                                                                                                   |
| G2  | 客户端在发起 POST 前，通过 Transport **过滤** body：普通发送仅含 **用户本轮**；审批后续写仅含 **审批结构化信息 + 助手消息标识**，不附整段 `messages` 数组。                                                                                                                          |
| G3  | **用户本轮 user 消息**在服务端 **持久化顺序明确**（见 §5），且与客户端 message **id** 策略一致，避免重复行与跨会话串 id。                                                                                                                                                            |
| G4  | **工具审批（`needsApproval`）** 在自动重发场景下行为可解释：SDK 对第二次请求仍使用 `trigger: 'submit-message'` 且 **`messageId` 为当前最后一条 assistant 的 id**；服务端根据 **窄 body 变体** 识别为审批续写并更新 DB / 续跑 Agent。                                                 |
| G5  | **image-fetch 视觉续轮**：采用 **外圈循环**（单次 HTTP 响应内可多段 `agent.stream` + `writer.merge`，或等价形态），配合 **`stopWhen` / 步数上限**；细节允许实现阶段微调，语义目标为：**需要注入后再生成时，不依赖客户端历史合并**。                                                  |
| G6  | **用户上传图**（`/api/images` → file part 含 `/api/images/{id}`）：DB 存引用；**调用模型前**仍允许保留一层「将本会话内引用解析为 Provider 可消费的 part」（实现上可与现 `hydrateApiImageFilePartsForModel` 同职责，名称可 refactor）。                                               |
| G7  | **Message 表职责收缩**：库表 **仅**支撑 **(a) 网页载入恢复时间线** 与 **(b) 服务端按会话拉取历史供模型构图**；不面向复杂 SQL 检索、全文搜索、运营报表。允许将行内结构 **向 UIMessage 形态拢一拢**（如单 JSON 载荷），减少 `content` / 分列 usage 等与 SDK 重复的心智负担（见 §12）。 |

---

## 3. 非目标（本期 SPEC 不强制展开）

- 替换 AI SDK 或放弃 `useChat` 流式协议。
- 加密 Message 载荷、多租户鉴权（Toy 假设单机）。
- 为「客户端与 DB 长期漂移」单独做轮询同步机制；**约定**为正常路径下前端与 DB 一致，异常以刷新 / 重试解决。

---

## 4. HTTP 请求体契约（需实现阶段落 JSON Schema / Zod）

### 4.1 顶层公共字段

- **`conversationId`**：`string`，必填。
- **`kind`**（或等价判别字段）：**`'user-turn' | 'tool-approval'`**（命名可由实现微调，但必须可 discriminated）。

### 4.2 `kind: 'user-turn'`（普通发话）

| 字段        | 必填     | 说明                                                                                                                      |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `messageId` | 建议必填 | 与客户端 `useChat` 为该条 user 生成的 **id** 一致，供服务端 **upsert** 同一行，避免重复插入。                             |
| `parts`     | 必填     | AI SDK **UIMessage** 的 `parts` 数组（文本、file、等）；含用户附件时 file part 引用 **`/api/images/{id}`** 等已存库形态。 |
| `role`      | 可省略   | 默认 **`user`**；若传则必须为 user。                                                                                      |

**禁止**：依赖本请求携带历史 assistant / 其它轮次的完整列表。

### 4.3 `kind: 'tool-approval'`（审批后自动续写）

| 字段                 | 必填 | 说明                                                                                                                              |
| -------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| `assistantMessageId` | 必填 | 待续写 / 已含待审批 tool 的 **assistant** 消息 id（与 SDK 传入的 `messageId`、本地最后一条 assistant id 一致）。                  |
| `approvals`          | 必填 | 数组；每项至少含 **`approvalId`**（与 tool part 上 `approval.id` 对齐）、**`approved`**（boolean）、可选 **`reason`**（string）。 |

实现可从 **单条 assistant** 内多个待审批 tool 扩展；若仅支持单次一项，须在 SPEC 实施备注中写死。

**禁止**：要求服务端从「整包客户端消息列表」推断审批结果；审批事实以本 payload + DB 更新为准。

### 4.4 与 SDK 的衔接说明（实现提示）

- `DefaultChatTransport` 默认会把 `id`、`messages`、`trigger`、`messageId` 打入 body；**必须通过 `prepareSendMessagesRequest` 返回自定义 body**，使其符合 §4.1–4.3，且 **勿**把完整 `messages` 原样转发。
- 审批自动发送时：**最后一条为 assistant**；**`messageId` 为该 assistant id**（SDK 行为，已在源码核对）。

---

## 5. 服务端处理顺序（建议固定写入顺序）

1. **校验** body（Zod / 自定义）。
2. **`kind: 'user-turn'`**：在启动 Agent 前 **upsert** 该条 **USER**（`messageId` + `parts`），使 `listMessages` 含本轮输入。
3. **`kind: 'tool-approval'`**：先将审批结果 **合并写入 DB** 中对应 assistant 消息（或等价 tool part 状态），再 **从 DB 构图** 续跑；禁止仅信任内存。
4. **构图**：`validateUIMessages` / `convertToModelMessages`（或 Agent 封装）使用 **DB 拉出历史 + 必要时本轮已写入行**；**不再**使用 `mergeClientMessagesWithDbForModel` 目标态路径。
5. **流式响应**：`createUIMessageStream` / `createUIMessageStreamResponse` 多段 merge **或** 经官方 **`createAgentUIStreamResponse`** 组合；需满足 `useChat` 对 message id / continuation 的约定（见 AI SDK 文档 `originalMessages`、`generateId`、`onFinish`）。
6. **用量**：延续从 **finish** metadata 读取并累计落库等现有产品约束（R19 中断等不改变 SPEC 主旨，实现时对照 `AGENTS.md`）。

---

## 6. 多段生成（image-fetch / 外圈循环）

- **外圈**：在同一 `createUIMessageStream` 的 `execute` 内使用 **`for` 循环**或等价：根据上一段 `stream` 结束时的 **决策**（如「本段曾调用 image-fetch 且需视觉注入 user」）决定是否再开下一段 `agent.stream`。
- **内圈**：每段仍用 **`ToolLoopAgent.stream`**；**`stopWhen`** 须包含 **步数上限**（如 `stepCountIs(20)`）与业务条件组合，避免仅此一轮无限循环。
- **与旧实现关系**：目标态 **可移除** `prepareStep` 注入，改由「切段 + DB 已有合成 USER + 下一轮构图」承担；若迁移期双轨，须在计划中写明删除顺序。

---

## 7. 中断与失败（Toy 最小语义）

- 客户端 **stop** → `abortSignal` 中止当前流；已完成 step 的 assistant 内容以 **已执行 `onStepFinish` / 持久化** 为准（与现有 R19 叙述一致）。
- **未正常结束**的 assistant 行：允许保留「部分 parts」于 DB；**下一轮 user** 仍以 DB 时间线接续；不在本 SPEC 规定复杂「快照回滚」，如有产品变更单独开文。

---

## 8. 验收场景（回归勾选）

- [ ] 新对话首条 / 多轮 **仅文本** user。
- [ ] **带 `/api/images/` 附件** user；刷新后时间线正确；模型侧能消费（解析引用层正常）。
- [ ] **工具审批**：待审批 → 通过 / 拒绝 → 自动续发；DB 与 UI 一致。
- [ ] **image-fetch**（或等价工具）触发后 **多段生成** 与 **刷新** 后上下文一致。
- [ ] **stop** 中断；无 LLM 时门闸仍有效（既有 R3）。

---

## 9. 文档与画布

- **本 SPEC 交付**：不包含源码修改；**全量实现与测试通过后**，按项目约定更新 `canvases/` 中「Agent 运行时与消息 Parts」「架构总览」等（见 `AGENTS.md`），避免人类读者与实现对齐断裂。

---

## 10. Message 表：目标 Schema 原则（重新设计）

### 10.1 职责共识（与产品一致）

- **仅两类读路径**：按 `conversationId` **时间序**列出消息 → **SSR / `initialMessages`**；同一份列表 → **validate / convert 后喂模型**。
- **无**强需求：按 `content` 做数据库全文检索、按分列 usage 做复杂 OLAP、跨会话消息扫描等（Toy 可忽略）。

在此前提下，**可以**把一行消息收成「**主键 + 外键 + 排序 + 与 AI SDK 对齐的一坨 JSON**」，而不必保留与 UIMessage **重复摊平**的多列，除非迁移成本或代码路径仍依赖某列。

### 10.2 建议保留的「表级」列（列名可实施时微调）

| 列               | 说明                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`             | 主键，`string`。与 **`UIMessage.id`** 一致（user / assistant 均由应用层写入时带齐），供 upsert、续写、`useChat` 合流。 |
| `conversationId` | 外键，会话隔离与 `listMessages` 过滤。                                                                                 |
| `createdAt`      | 时间序；**不要**只靠 JSON 内嵌时间排序。                                                                               |
| `payload`        | **`Json`**，存 **一条消息与 `validateUIMessages` / `UIMessage` 可往返对齐的核心字段**（见下）。                        |

可选（**冗余、非必须**）：`role` 枚举列 —— 若希望极少数管理 SQL 一眼区分 USER/ASSISTANT，可从 `payload.role` 派生同步写入；**不建也行**，读时从 `payload` 解析即可。

### 10.3 `payload` 建议形态（与 UIMessage 对齐，而非整张 Prisma 行冒充 UIMessage）

推荐写入 **AI SDK 认知里的子集**（实施时用 Zod / 类型收窄），例如：

- **`role`**：`'user' | 'assistant'`（以及若你们确需 system 行：`'system'`，与现 `MessageRole.SYSTEM` 对齐时再定）。
- **`parts`**：与 **UIMessage.parts** 同构的 JSON 数组（text / file / tool-\* / step-start 等）。
- **`metadata`**（可选）：如 **`usage`**（`inputTokens` / `outputTokens` / `totalTokens`）、**`modelIdAtTime`** 等当前散落在列上的信息，**整体迁入**此处即可满足 **用量条** 与 **续写累加**；读 `aggregateUsage` 时改为 **遍历各行 `payload.metadata.usage`**（或 Toy 阶段改为「仅读最后一条 assistant」若产品接受）。

**`id` 是否重复进 `payload`**：可省略（表主键即真源）；若客户端回放需要「纯 JSON 即一条 UIMessage」，可在读出组装时 **`{ id: row.id, ...payload }`**。

### 10.4 与**当前** `Message` 表的差异（迁移时要动什么）

**当前（Prisma）**：`role` 枚举、`content`（必填）、`parts`（可选 Json）、`usage*` 三列、`modelIdAtTime` 等。

| 当前字段                   | 目标态处理                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content`                  | **删除或弃用**：旧 M1 行可迁移时由 `parts` 文本拼一次写入 `payload`；新行不再维护单独 `content`。`mapDbMessagesToInitialMessages` 改为只认 `payload.parts`（或兼容分支读旧列）。 |
| `parts`                    | **合并进 `payload.parts`**；迁移脚本：`payload = { role, parts, metadata? }`。                                                                                                   |
| `usage*` / `modelIdAtTime` | 迁入 **`payload.metadata`**（或约定 assistant 行专用子结构）。                                                                                                                   |
| `MessageRole.SYSTEM`       | 若仍存在：要么 **`payload.role === 'system'`**，要么仍用表级 `role` 冗余列；与 `validateUIMessages` 对 system 消息策略一致即可。                                                 |

### 10.5 迁移与风险控制

- **数据迁移**：建议 **Prisma migrate** + 一次性 backfill：旧行 → 新 `payload`；新代码 **双读** 开关期可选（Toy 可一步切换 + `migrate dev` 在本地重置亦可接受，由你们定）。
- **外键**：`modelIdAtTime` 若保留为 **FK 列**，与「全进 JSON」冲突；目标态更简做法是 **只在 metadata 存 model id 字符串**，删除 FK 约束（历史引用不强制 referential 完整性，与「删除 Model 时 Message 置空」现有语义可再定）。
- **测试**：`tests/db/messages.test.ts`、`tests/prisma/schema.test.ts`、`tests/api/chat/route.test.ts` 中与 `content` / 分列 usage 相关的断言需整批更新。

### 10.6 暂不写入 SPEC 的细节

- 具体 Prisma `schema.prisma` 逐字 diff、迁移文件名、是否保留 `content` 为生成列 —— **留到 implementation plan**；本节只锁 **产品级形状与职责**。

---

## 11. 相关索引（迁移时对照）

- 当前路由：`app/api/chat/route.ts`
- 当前合并：`lib/ai/conversation-history-merge.ts`
- 当前校验：`lib/validation/chat-post-schema.ts`
- 前端 Transport：`app/conversations/[id]/ChatPage.tsx`（`prepareSendMessagesRequest`）
- AI SDK：`prepareSendMessagesRequest`（`node_modules/ai/docs/04-ai-sdk-ui/21-transport.mdx`）、`createUIMessageStream`（`07-reference/02-ai-sdk-ui/40-create-ui-message-stream.mdx`）
- SSR 映射：`lib/conversations/initial-messages.ts`
- 当前 Prisma：`prisma/schema.prisma` · `model Message`

---

## 12. 修订记录

| 日期       | 摘要                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-03 | 初稿：DB 唯一源、窄 body 两种 kind、写顺序、外圈循环、验收与索引。                                                                  |
| 2026-05-03 | 增 §10：Message 表职责收缩、`id + conversationId + createdAt + payload(Json)` 目标形态、与现行列差异及迁移原则；目标表新增强调 G7。 |
