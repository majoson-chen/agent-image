# SPEC：Provider（Model）Register 架构与数据模型

## 文档状态

- **类型**：实现前架构 / 产品 SPEC（汇总多轮对话结论；工程量大，**允许多个 implementation plan 分期落地**）。
- **术语**：需求文档中的 **Model** 与本 SPEC 的 **Provider / Register** 指同一业务概念；持久化实体仍称 **`Model` 表行**（或迁移后等价表）。
- **产品定位**：`agent-image` 单机自用 **Toy**；密钥明文落库与现版一致，加密 deferred。
- **伪代码**：`prisma/demo.prisma` 仅曾用于说明意图，**不是** schema 真源；以本 SPEC §5 为准。

---

## 1. 背景与动机

1. **SKU 级 Register**：每一种可配置的「模型档位」（如 `kimi-k2.6`、某 Seedream SKU）以 **独立 Register** 存在；Register 之间 **不互相 import**，仅依赖 **共享内核**（HTTP、落库、图像解析等）。
2. **统一存储形状**：现行 `Model` 按 `ProviderType` 与多列（`apiKey`、`baseURL`、`capabilities`…）扩展，与「每 SKU 一套 config」冲突。目标改为 **`registerId` + `type` + 用户标签 + `config` JSON**，校验与默认值 **全部在 Register 端**（Zod）。
3. **目录单一真源**：**完整 Register 列表只维护在代码**（静态 Registry）。**DB 只存用户已配置的记录**，不把「所有 registerId」预写入库。
4. **工具体验**：生图等工具由 Register 声明 **schema / 执行体**；是否支持 **参考图（`imageId`）** 因 SKU 而异，由 Register 自行暴露 `inputSchema`，执行时经 **内核** 按 `conversationId` 校验并解析图像。
5. **可观测性**：开发环境集成 **`@ai-sdk/devtools`**（仅包裹 **LLM `LanguageModel`**）。

---

## 2. 目标（目标态必须满足）

| ID  | 陈述 |
| --- | --- |
| G1 | 存在 **静态 Registry**（单一聚合入口），可枚举每条 Register 的 **`registerId`、`modelType`（LLM \| IMAGE \| SEARCH）、展示用元数据**（标题、可选描述、排序）。 |
| G2 | **设置页** 保持 **三个独立板块**（LLM、IMAGE、Search）；各板块内选择器 **仅列出 `modelType` 匹配的 Register**。用户选定 Register 后 **懒加载** 该 Register 的配置 UI（弹窗或等价），提交后 **写入 DB** 一条用户配置。 |
| G3 | **`Model` 持久化**（或迁移后同义表）以 **`registerId` + `type` + `name`（用户可读标签）+ `config`（Json）** 为主；**不在 DB 中**维护「全量 Register 目录」。 |
| G4 | **Register 职责**：解析/校验 `config`；为 **LLM** 产出 AI SDK **`LanguageModel`**；为 **IMAGE** 产出 **工具定义 + execute**（或等价可挂载到 `ToolLoopAgent` 的形态）；为 **SEARCH** 产出搜索工具或执行函数；**禁止** Register 间循环依赖。 |
| G5 | **运行时错误**：优先以 **结构化 tool result** 返回给模型（**不得**在 result 中泄露 `apiKey`、完整授权头或未脱敏的原始 HTTP 体）；必要时辅以简短 `message` / `code` 供 LLM 调整策略或提示用户检查设置。设置页保存失败仍走 **HTTP 层校验错误**（非 tool result）。 |
| G6 | **参考图**：若 Register 声明支持，工具入参可含 **`imageId`（及数量上限由 Register 定义）**；解析通过 **共享内核**（校验图像属于当前 `conversationId`，再转 bytes/URL/厂商所需形态）。不强制单独增加「仅给模型用的 fetch 工具」，除非后续产品明确要求两步显式化。 |
| G7 | **DevTools**：开发环境下对 **传入 Agent 的 LLM** 使用 `wrapLanguageModel` + `devToolsMiddleware()`；**生产构建不得启用**（避免写 `.devtools/generations.json` 与额外开销）。 |

---

## 3. 非目标（本 SPEC 不一次性强制）

- 远程拉取 Register 目录、A/B 灰度发布平台。
- `config` 字段级加密（与现版一致，deferred）。
- 为所有历史消息批量重写 `Model` 外键语义（迁移策略见 §9，允许分阶段）。
- 用 Register 替换 **非 Model 业务**（会话、消息、图像 blob 存储规则不变）。

---

## 4. Register 结构（逻辑约束）

### 4.1 划分粒度

- **一个 SKU 一条 Register**（用户已选方案 **2**）：例如 `alibaba/kimi-k2.6` 与 `dashscope/wan2.7-image-pro` 各为独立模块。
- **共享代码**：仅允许出现在 **`lib/providers/_internals/`**（或等价路径）等 **非 Register 目录**；Register 仅 `import` 内核与类型，**不** `import` 其他 Register。

### 4.2 `registerId` 约定

- 稳定字符串，建议 **小写 + `/` 分段**，如 `alibaba/kimi-k2.6`；与 DB 存值、Registry 元数据 **一致**。
- **展示名**：DB `name` 为用户可改标签；**勿**用 `name` 作为路由键。

### 4.3 Registry 聚合

- **一个**模块导出「全量 Register 元数据列表」+「`registerId` → 运行时工厂」映射（或等价两张表）。
- 元数据用于设置页列表；工厂用于 `getModel` 后 **根据 `registerId` 分发** 到正确 Register。

---

## 5. 数据模型（Prisma 目标形态）

以下描述 **目标态**；具体列名可与迁移脚本微调，语义不变。

### 5.1 `Model`

- `id`、`type`（`ModelType`：`LLM` \| `IMAGE` \| `SEARCH`）。
- **`registerId`**：`String`，对应 Registry 中的稳定 id。
- **`name`**：`String`，用户可读标签（列表、侧栏）。
- **`config`**：`Json` — **opaque at DB layer**；由对应 Register 的 Zod/schema 校验。
- `createdAt` / `updatedAt`。

**移除/吸收**（迁移后不再依赖 DB 枚举驱动业务）：现行 `providerType`、`baseURL`、`apiKey`、`contextWindow`、`extraHeaders`、`capabilities` 等列 —— **能迁入 `config` 的迁入**，无法表达的由 Register 默认常量承担。

索引建议：`@@index([type])`、`@@index([registerId])`（列表与校验够用即可，避免过度设计）。

### 5.2 保持不变意的关系（概念上保留）

- **`ConversationModelSelection`**：仍绑定 **`modelId`** + `params`（会话级 override，如生图 `size`、LLM thinking 开关）；语义与现版一致。
- **`SearchToolBinding`**：**`WEB_SEARCH` / `IMAGE_SEARCH` 仍指向某条 `Model` 行**（`type === SEARCH`）；不改为「每条 binding 冗长 config」unless 实现发现必要。
- **`Image.modelIdAtTime`**：历史生成归因仍 FK 至 `Model`；删除 Model 时行为与现版 **`SetNull`** 策略对齐（SPEC 不收窄产品含义）。

### 5.3 DB 不做的事

- **不**预制「所有 `registerId`」行。
- **不**在 DB 层对 `config` 做 JSON Schema（校验在应用层 Register）。

---

## 6. 设置页 UX（与现行排版对齐）

1. **LLM / IMAGE / Search** 三区独立入口。
2. 每区：**添加** → 下拉或列表 **`modelType` 匹配的 Register 元数据** → 选定后 **异步加载 Register 的配置组件** → 用户填写 → 校验通过 → **`Model` 入库**。
3. **已保存列表**：自 DB 读取；编辑某条时已知 `registerId`，加载同一 Register UI 并预填 **`parse(config)`** 结果。

复杂度控制：**不做**全局搜索、不做跨类型统一 wizard。

---

## 7. Agent / Chat 运行时

1. **`LLM`**：根据选型 `modelId` 读 **`Model`** → `registerId` → Register 产出 **`LanguageModel`**；devtools 仅在 dev 对该实例 wrap。
2. **Tools**：`buildAvailableTools`（或继任者）根据会话选型挂载 **IMAGE / SEARCH** Register 产物；命名可与现 `image-generate-primary` 等对齐或按 Register 元数据映射（实现计划再定，需兼容 UI tool part）。
3. **差错**： executor 捕获异常 → 映射为 **结构化 tool output**（G5）；服务端日志可保留完整堆栈（不喂给模型）。

---

## 8. `@ai-sdk/devtools`

- 依赖已存在于 `package.json`；集成方式以包内 README 为准：`devToolsMiddleware()` + `wrapLanguageModel`，本地 **`npx @ai-sdk/devtools`** 查看。
- **仅 LLM** 路径需要 wrap；图像/搜索 HTTP **不**经该 middleware。

---

## 9. 迁移与分期建议

本工程 **偏大**，允许 **多条 plan**：

1. **Phase A**：引入 Registry + 新 `Model` 形状 + 读写 API + 一席 Register 试水（如不破坏现有枚举的过渡期双读）。
2. **Phase B**：迁移设置页三区 + 懒加载配置组件；迁移或脚本导入旧 `Model` → `registerId + config`。
3. **Phase C**：下架 `ProviderType` 业务依赖；删列/收口工厂文件（`llm-provider-factory`、`image-provider-factory` 等）由 Register 替代。
4. **Phase D**：参考图工具 schema + 内核 `resolveConversationImage` + 回归测试。
5. **Phase E**：DevTools 接入 + 环境门控。

顺序可交错，但 **G1–G3** 应先于大规模 SKU 扩充。

---

## 10. 测试要点（TDD 友好）

- Registry：**给定 `modelType` 枚举出的 id 列表**包含/不包含正确。
- 各 Register：**config Zod round-trip**；无效 config 被拒绝。
- **Tool execute**：mock 内核 HTTP 下，验证 **成功返回** 与 **结构化错误 result** 均符合约定且无密钥泄漏。
- **迁移**：旧数据 → 新行的 characterization 测试（若有脚本）。

---

## 11. 与 AGENTS.md 的衔接

- 继续遵守 **单机 Toy**、密钥明文、会话选型与工具暴露规则（R3/R9 等）；本 SPEC **替换**「以 `ProviderType` 分叉」的实现策略，**不**替换需求文档中的条目编号语义。
- **Import 别名**：新代码仍需符合 `@lib/*`、`@/*` 等仓库约定。

---

## 12. SPEC 自检（落盘时已检查）

- 无「全量 registerId 入库」的矛盾表述。
- 目录真源唯一、DB 仅存用户实例。
- 错误路径分为 **设置校验** vs **tool result**。
- 分期实施显式写明，避免单 plan 过载。
