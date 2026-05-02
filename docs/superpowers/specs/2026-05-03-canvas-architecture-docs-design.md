# Canvas 架构文档集：设计说明

## 目标

为 agent-image 仓库创建一套面向**人类读者**的 Cursor Canvas 文档，覆盖整体架构与各核心子系统。

读者在不打开代码文件的情况下，通过阅读这套文档，应能掌握项目的代码组织结构与模块关系，具备继续进行 Agent 驱动开发所需的上下文。

## 非目标

- 不是产品使用说明（不介绍如何操作界面）
- 不是 API 速查表（不只罗列函数签名）
- 不解释设计决策的动机（只陈述代码当前是如何组织的）
- 不参与 Agent 工作协同（不是 AGENTS.md 或 skill 文档）

## 画布集规划

共 **6 张**画布，一张总览 + 五张子系统。每张独立，无强制阅读顺序。

### 1. 架构总览

**文件名：** `架构总览.canvas.tsx`

**内容：**
- 仓库三层目录结构：`app/`（UI 层）→ `lib/`（业务逻辑层）→ `prisma/` + SQLite（数据层）
- 六个核心模块的区块图，标出每个模块所在目录与主要入口文件
- 一条简化请求生命周期：客户端 → `POST /api/chat` → Agent → stream → 前端
- 各子系统画布的名称与对应主题索引

### 2. 数据模型

**文件名：** `数据模型.canvas.tsx`

**内容：**
- Prisma schema 中的 6 张表：`Model`、`Conversation`、`Message`、`ConversationModelSelection`、`Image`、`SearchToolBinding`
- 字段速览 + 表间关系（ER 结构）
- 枚举取值速查：`ModelType`、`ProviderType`、`SelectionRole`、`ImageSource`、`SearchTool`、`MessageRole`
- 各表的 cascade / `SetNull` 删除行为说明
- Settings UI 表单字段与数据表字段的对应关系

### 3. Provider 工厂

**文件名：** `Provider工厂.canvas.tsx`

**内容：**
- LLM 工厂链：`lib/llm-provider-factory.ts` 的 `buildLlmModel()`，三个 `providerType` 分支（OPENAI / OPENAI_COMPATIBLE / ALIBABA）及其各自参数差异
- 图像工厂链：`lib/image-provider-factory.ts` 的 `executeImageGeneration()`，两个执行路径（Seedream / DashScope WAN）及各自的 HTTP 交互方式与超时设置
- Presets 文件（`lib/image/seedream-presets.ts`、`lib/image/wan-image-presets.ts`）的作用范围：默认 API URL 与参数映射逻辑
- `lib/llm-chat-provider-options.ts`：LLM 请求时附加的 provider-level 选项（如 thinking 参数）的计算入口

### 4. 工具系统

**文件名：** `工具系统.canvas.tsx`

**内容：**
- `lib/tools/tool-registry.ts` 的 `buildAvailableTools()` 工作流：每次请求动态组装 `ToolSet`，组装结果直接影响 Agent 能力与 system prompt 内容
- 三类工具的暴露条件（常驻 / 绑定驱动 / 选型驱动）及各工具的实现文件
- 各工具的输入输出概览（参数签名、返回结构）
- `lib/tools/ssrf-guard.ts`：`web-fetch` 的 URL 验证逻辑，私有地址范围拦截

### 5. Agent 运行时与消息 Parts

**文件名：** `Agent运行时与消息Parts.canvas.tsx`

**内容：**
- `/api/chat` 的 `handleChatPost()` 主流程步骤：请求解析 → 选型读取 → 工具组装 → Agent 构建 → stream 返回
- `lib/ai/build-agent.ts` 的 `buildAgent()`：对 AI SDK `ToolLoopAgent` 的薄封装，接受的参数结构
- `onStepFinish` 回调链：每个 step 结束后 `appendStepToParts` → `patchToolResultsFromResponseMessages` → `upsertAssistantMessage`（中间态持久化）
- UIMessage parts 的三种类型：`text` / `tool-call` / `tool-result`，及其 JSON 字段结构
- Continuation 判断：最后一条客户端消息为 `assistant` 时复用同一 `runId` 继续追写
- Usage 累加机制：每个 step 的 `inputTokens` / `outputTokens` 逐步叠加，来源为 API 响应字段

### 6. 视觉上下文注入

**文件名：** `视觉上下文注入.canvas.tsx`

**内容：**
- `lib/ai/image-fetch-vision-injection.ts` 的三个主要函数：`extractImageFetchBatchesFromStep`、`buildVisionUserModelMessage`、`buildVisionUserUiParts` 的职责与调用时机
- `prepareStep` 钩子（在 `/api/chat` 中定义）：在每个新 step 启动前检测上一 step 是否有未注入的 image-fetch 结果，有则调用 `buildVisionUserModelMessage` 把图像 data URI 插入 AI SDK 消息链
- `onStepFinish` 中的 DB 路径：调用 `buildVisionUserUiParts` + `createUserMessageWithParts` 把图像写入 DB 用于 UI 重载
- 两个去重 Set 的各自管辖范围：`modelInjectedImageFetchToolCallIds`（防止重复注入 AI 消息链）vs `dbPersistedImageFetchToolCallIds`（防止重复写 DB）
- DB 路径失败的处理：仅打 `console.warn`，不中断当前推理流程

## 写作规范

- **体裁**：指南文档，以结构叙述为主，表格作为辅助
- **视角**：陈述代码当前状态，不解释设计动机
- **代码引用**：列出文件路径和函数名；如需示意代码结构，使用伪代码，不直接贴源码
- **语言**：简体中文，术语保留英文（函数名、文件路径、类型名等）
- **颜色**：使用 `useHostTheme()` token，禁止硬编码 hex

## 自检

- 无 TBD：6 张画布内容均已列明
- 一致性：各画布覆盖范围不重叠（数据模型不重复讲工具，运行时不重复讲 Provider）
- 范围：仅文档，不涉及任何产品功能变更
