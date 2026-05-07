# SPEC 草案：Register Hook 系统（文字设计）

## 文档状态

- **类型**：设计与术语规范（Draft）；描述 **钩子（Hook）在 Register / Catalog / Kernel 三重角色中的语义与命名**，不绑定具体 TS 签名实现细节——实现阶段再落类型与迁移 PR。
- **读者**：下一轮实施 Agent 与人类维护者。
- **关联**：[Register 作为主 SPEC](./2026-05-07-provider-register-architecture-spec.md)、[插件定性标准](./2026-05-08-register-as-plugin-qualitative-standard.md)、[开发备忘录](../../guides/register-system.md)。

---

## 1. 术语：Hook 在本仓库指什么？

**Hook** ≠ 任意运行时回调，也 ≠ 事件总线。

在本设计中，**Register Hook** 指：某条 SKU（`registerId`）在 **静态 Catalog 行**上声明的、**类型化、可选的扩展点函数**。Kernel **只**通过 Catalog 按 `registerId` 取得该行并 **调用已声明的钩子**；**禁止**在 Kernel 内再写 `switch (registerId)` 或维护「某能力仅适用于哪几个 id」的平行名单。

**记忆句**：_Hook 是 Register 对 Kernel 的 **能力出口**；Catalog 是 **唯一索引**；Kernel 是 **无厂商知识的调度器**。_

---

## 2. 设计目标

| ID  | 陈述                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | 凡 **厂商 / SKU 特有** 的行为（请求体形态、响应解析、工具入参 schema、AI SDK `providerOptions`、搜索 HTTP 等），**必须**可通过某条 Catalog 行上的 Hook 表达或委托给该行关联的 Register 模块。 |
| H2  | Kernel **不得**维护与具体 `registerId` 列表耦合的分支逻辑（含 `Set<string>` 白名单）；若需「谁支持某能力」，由 **schema + Catalog 上是否挂载对应 Hook** 推导。                                |
| H3  | Hook **按能力命名、按类型约束**：LLM / IMAGE / SEARCH 各自可见的子集不同；未实现的 Hook 视为 **不支持该能力**。                                                                               |
| H4  | Register **SKU 模块之间不互相依赖**；Hook 实现可复用 **vendor-shared**、**`_internals`** 或 **中立子模块**，规则同现有 SPEC。                                                                 |

---

## 3. Catalog 行与 Hook 的关系

- **Catalog 行** = 现有元数据（`registerId`、`modelType`、标题等）+ **config Zod schema** + **零个或多个 Hook**。
- **解析 config** 仍统一走 `parseModelConfig(registerId, raw)`；Hook 的入参以 **已持久化的 `Model` 行** 和/或 **已解析的 config** 为主，避免重复解析策略分叉。
- **派发规则**：Kernel 在需要某能力时，调用形如 `getCatalogHooks(modelType, registerId)`（命名可随实现调整）取得该行；若某 Hook 为 `undefined`，则采用 **明确的全局默认**（例如「无 `providerOptions`」）或 **报错（能力缺失）**，由调用场景定义，不得在 Kernel 硬编码特例补洞。

---

## 4. Hook 命名公约（语言文字层）

以下为 **推荐使用的能力名（概念名）**；实现时可映射为同义方法名（如 `build*` / `compute*`），但 **文档与 Code Review** 应以下列 **能力 ID** 对齐。

### 4.1 通用约定

- 前缀语义：**build-** = 构造可长期持有或可被 Agent 挂载的对象（如 LanguageModel、Tool）；**compute-** = 由当前配置 **纯派生**（或仅以 DB 行为副作用）的请求级选项（如 `ProviderOptions`）；**describe-** = 仅供 UI / 文案 / 观测的元扩展（少用）。
- **幂等与缓存**：若无特别说明，Hook 应为 **单次调用语义清晰**；不在此文档规定缓存——由实现决定。
- **错误**：Hook 内 **可抛错** 表示配置不合法；**结构化 tool 错误**仍遵守主 SPEC G5（与 HTTP 设置错误区分）。

### 4.2 LLM 类 Hook（`modelType === LLM`）

| 能力 ID                                    | 含义                                                                                                | 典型产出                       | 必填性                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ |
| `llm.languageModel`                        | 由 `Model` 行构造 AI SDK **`LanguageModel`**                                                        | `LanguageModel`                | **必填**（LLM SKU 必选） |
| `llm.chatProviderOptions`                  | 由 `Model` 行构造单次对话 / Agent 步骤可用的 **`ProviderOptions`**（如 `@ai-sdk/alibaba` thinking） | `ProviderOptions \| undefined` | **可选**；缺省表示不注入 |
| （预留）`llm.ui.supportsThinkingIndicator` | 是否允许设置页展示「思考」相关控件                                                                  | boolean 或等价                 | 可选                     |

**说明**：与 AI SDK 一致，`providerOptions` 归属 **请求 / Agent** 路径，不要求塞进 `createXxx()` Provider 工厂；由本 Hook **计算**再在 `buildAgent` / stream 边界传入。

### 4.3 IMAGE 类 Hook（`modelType === IMAGE`）

| 能力 ID                           | 含义                                                                                                | 典型产出                   | 必填性                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image.tool`                      | 构造挂载到 ToolLoopAgent 的 **单条生图工具**（含 **inputSchema、execute、描述、needsApproval** 等） | AI SDK `Tool`              | **必填**（参与 Agent 的生图 SKU）                                                                                                                 |
| `image.execution`                 | 封装 **单次生图远程调用**：HTTP、响应拆解、超时、与 `conversationId`/参考图参数的衔接               | Promise\<结构化成功/失败\> | **建议与 `image.tool` 同 Register 共用实现**；是否拆成两个 Hook 由实现选型，但若拆分，二者须 **同属一条 Catalog 行**，Kernel 不累加第三个分支文件 |
| （可选）`image.defaultToolParams` | 由 `ConversationModelSelection.params` + config 推导 **默认 size** 等工具级默认                     | 小号值对象                 | 可选，避免 `tool-registry` 读 capability                                                                                                          |

**说明**：参考图、`imageId` 上限仍以 **工具的 inputSchema** 表达为主；图像归属校验保持在 **Kernel 共享内核**（主 SPEC G6）。

### 4.4 SEARCH 类 Hook（`modelType === SEARCH`）

| 能力 ID        | 含义                                                                                | 典型产出                            | 必填性                                           |
| -------------- | ----------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| `search.tools` | 由绑定到会话的 SEARCH `Model` 构造 **可被 Agent 挂载的 ToolSet（子集）** 或等价工厂 | `Record<string, Tool>` 或可合并结构 | **必填**（若该产品路径仍通过 Search Model 绑定） |

**说明**：若未来存在「单次 Register 产出 web + image 双工具」，由该 Hook **一次返回多块**；Kernel 只做挂载，不拆分 Brave 专有 URL。

### 4.5 不设 Hook 的能力（留在 Kernel）

以下 **不是** Register Hook，避免概念膨胀：

- **会话归属**、消息持久化、`Image` 落盘、conversation 级选型的读取。
- **通用** `parseModelConfig` 与 Unknown `registerId` 的错误语义。
- **DevTools 包裹策略**（仅与环境变量/构建模式相关时可留在 Kernel）。
- **`GET /api/register-metadata`** 的列表数据源仍是 Catalog **元数据**，不单独称 Hook。

---

## 5. Kernel 调用图景（语义层）

用语言描述 **单次 Chat 装配**的顺序（实现可微调顺序，但依赖关系如下）：

1. 读出 LLM **`Model`** 行 → Catalog 取其 LLM 行 → **`llm.languageModel`** → 得到 Agent 的主模型实例。
2. 同一行 → **`llm.chatProviderOptions`** → 若有则与其它 Agent 参数合并传入（与测试注入路径的优先级在实现计划中写死）。
3. 会话工具：`buildAvailableTools` 仅从 **选型 + Search/Image 绑定** 拉取 **`Model`** 行 → 对每条相关行调用 **对应类型的 Hook（`image.tool`、`search.tools`）** → 组装 `ToolSet`。
4. 工具 **execute** 内部若需远程生图 → 仅用该 SKU 在行内或通过 **`image.execution`**（若单独暴露）完成；Kernel 不提供 `fetch` 模板之外的厂商捷径。

全文不出现「若为 Seedream 则…」，只出现「若该行提供某 Hook 则调用」。

---

## 6. 与「妥协」路线的边界

本文档定义的 Hook 系统是 **完整性目标**：最终态下，**不应**再在 `lib/tools/image-generate.ts`、`lib/tools/tool-registry.ts`、`lib/llm-chat-provider-options.ts` 或 **共享派发层**中以 **`switch (registerId)`** 等形式保留 **`registerId` 特化分支**。（生图派发入口 `lib/providers/registers/_shared/image-execute/execute.server.ts` 仅允许 **Catalog 派发**，不得再含厂商枚举。）

---

## 7. 后续工作（非本文范围）

- 将能力 ID **映射到具体 TypeScript interface**、`server-only` 边界与 vitest 用例矩阵。
- `ce-plan` / implementation plan：**文件移动顺序**（一户一地）、**PR 粒度**、**兼容性**（无二阶段线上破坏）。
- 更新 [开发备忘录](../../guides/register-system.md) 中「必读锚点」与「新增 Register 清单」，与 Hook 表对齐。

---

## 修订记录

| 日期       | 说明                                                         |
| ---------- | ------------------------------------------------------------ |
| 2026-05-08 | 初稿：Hook 定义、命名能力表、Kernel 语义流程、与非 Hook 分界 |
