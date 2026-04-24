# AGENTS.md — agent-image

面向在本仓库工作的 AI 与协作者：产品目标、技术栈、文档入口与 Compound Engineering 工作流。

## 项目是什么

**agent-image**：单机自用的玩具级 **Next.js** 应用，提供「类 Cursor / Claude Code」的 **多轮对话 Agent**，默认任务偏向 **图像生成与编排**（工具可见、多步），支持 **多厂商 LLM 与生图 Provider**（各 Provider 自带 baseURL 与密钥，不假设全局单一 API Key）。

权威需求说明见：`docs/brainstorms/2026-04-23-agent-image-requirements.md`。  
推荐性 Agent 工作流与能力要点（供 Prompt 对照）：`docs/brainstorms/2026-04-23-agent-image-agent-playbook.md`。

## 技术栈（当前）

- **运行时 / 包管理：** [Bun](https://bun.sh)（`bun install`、`bun dev`）
- **框架：** Next.js（App Router）、React、TypeScript
- **数据：** SQLite + Prisma（`@prisma/adapter-better-sqlite3`），客户端生成目录 `generated/prisma/`
- **对话与工具（规划）：** Vercel AI SDK；敏感能力走服务端 Route Handler（如 web-fetch）
- **编辑器：** 已在 Cursor 安装 **Prisma 扩展（插件）**。修改 `prisma/schema.prisma`、查看模型与迁移、使用扩展提供的补全/格式化/数据库视图时，以扩展为准；**迁移与 generate** 仍以项目内 Prisma CLI 为准（例如 `bun --bun run prisma migrate dev`、`prisma generate`，见 `prisma.config.ts`）。

默认本地数据库 URL：`prisma.config.ts` / `lib/prisma.ts` 中 `DATABASE_URL` 未设置时为 `file:./data.db`（仓库根目录相对路径，已 `.gitignore`）。

## 本仓库内的 Agent Skills（项目级）

以下技能安装在 **`.agents/skills/`**（随仓库版本控制）。当任务涉及对应技术时，**应先阅读该目录下的 `SKILL.md` 及其中引用的 `references/` / `rules/`**，再改代码或给方案；不要仅凭过时记忆拼 API。

在 Cursor 中可通过 `@.agents/skills/<技能名>/SKILL.md` 引用，或用 Read 工具打开同名文件。

| 技能目录 | 适用场景 |
|----------|----------|
| `ai-sdk` | Vercel AI SDK：`streamText` / `generateText`、工具调用、`useChat`、Provider、结构化输出、Agent 编排等 |
| `next-best-practices` | Next.js 目录约定、RSC 边界、数据获取、Route Handler、metadata、错误处理、图片/字体等通用实践 |
| `next-cache-components` | Next 16+ Cache Components、`use cache`、`cacheLife` / `cacheTag`、PPR 相关 |
| `vercel-react-best-practices` | React / Next 性能、重渲染、数据与缓存、包体与加载等（Vercel 规则集） |
| `vercel-composition-patterns` | 组合式组件、减少 boolean props、Context、React 19 相关 API |
| `vercel-react-view-transitions` | View Transition API、路由/列表过渡、`<ViewTransition>` 与 Next 集成 |
| `ast-grep` | 按 AST 结构搜索/盘点代码（复杂模式优于纯文本 grep） |

若以后新增或移除技能，请同步更新本表。

## 仓库约定

- **需求 / 范围：** 变更产品行为时先更新或对照 `docs/brainstorms/*-requirements.md`。
- **实现规划：** 使用 Compound Engineering 的 `/ce-plan`，以需求文档为 origin。
- **本地 CE 配置：** `.compound-engineering/config.local.yaml`（gitignore）；示例与模板见同目录 `config.local.example.yaml`。
- **不要**在仓库中引入「全应用唯一厂商 API Key」环境变量作为产品前提；密钥按 Provider 存库（见需求文档 R2）。

## Compound Engineering 工作流

| 目的 | 技能 / 命令 |
|------|-------------|
| 发散需求、落盘 requirements | `/ce-brainstorm` → `docs/brainstorms/*-requirements.md` |
| 结构化实现计划 | `/ce-plan` → `docs/plans/` |
| 环境与健康检查 | `/ce-setup`（本仓库无自带 `scripts/check-health` 时，使用插件内脚本，见 README） |

## 实现时注意

- 对话页须支持用户切换：**LLM**、**主生图**、**次生图**（可选）；新对话初始未选，至少选定 LLM + 主生图后才可发消息。
- 上下文用量可视化：仅用 API 返回的 `usage` 更新，不做本地 token 估算。
- 生图参数（分辨率等）遵循各 Provider 声明的能力；不提供用户侧参考图张数上限配置。

## 前端 / 代码风格

- 与现有 ESLint、TypeScript 配置保持一致；优先小步提交、避免无关重构。
- **Tailwind（`className`）**：拼条件类名、合并冲突工具类时统一使用 **`cn()`**（`lib/cn.ts`，`clsx` + `tailwind-merge`），不要手写长模板字符串拼接或忽略冲突覆盖。
- 用户规则要求中文沟通时，文档与注释可按团队习惯中英并存；本文件以中文为主便于本地阅读。
