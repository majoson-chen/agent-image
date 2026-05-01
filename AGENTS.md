# AGENTS.md — agent-image

面向在本仓库工作的 AI 与协作者：产品目标、技术栈、文档入口与 Compound Engineering 工作流。

## 项目是什么

**agent-image**：单机自用的玩具级 **Next.js** 应用，提供「类 Cursor / Claude Code」的 **多轮对话 Agent**，默认任务偏向 **图像生成与编排**（工具可见、多步），支持 **多厂商 LLM 与生图 Provider**（各 Provider 自带 baseURL 与密钥，不假设全局单一 API Key）。

权威需求说明见：`docs/brainstorms/2026-04-23-agent-image-requirements.md`。
推荐性 Agent 工作流与能力要点（供 Prompt 对照）：`docs/brainstorms/2026-04-23-agent-image-agent-playbook.md`。
界面布局参考（如有）：`design/`（例如 `design/layout.pen`）。
**设计语言与主题（须先于设置页/业务组件落地）：** [daisyUI 5](https://daisyui.com/) + `docs/design-language.md`。`app/globals.css` **暂仅** `@plugin "daisyui"`，使用内置 **`light` / `dark`**（与官方默认：`light --default`，`dark --prefersdark`）；界面使用 **语义色**（`bg-base-100`、`text-base-content`、`btn-primary` 等），**禁止**在组件中硬编码 `#hex` 或滥用 `bg-green-500` 等非语义调色板。设计稿（Pencil）填色对照 `docs/plans/2026-04-23-001-feat-chat-ui-shell-plan.md` 中的 **设计稿用色** 表；该文件为 **设计交付规格**，工程实现任务不在其内。

## 技术栈（当前）

- **运行时 / 包管理：** [Bun](https://bun.sh)（`bun install`、`bun dev`）
- **框架：** Next.js（App Router）、React、TypeScript
- **数据：** SQLite + Prisma（`@prisma/adapter-better-sqlite3`），客户端生成目录 `generated/prisma/`
- **对话与工具（规划）：** Vercel AI SDK（v6）；敏感能力走服务端 Route Handler（如 web-fetch）
- **编辑器：** 已在 Cursor 安装 **Prisma 扩展（插件）**。修改 `prisma/schema.prisma`、查看模型与迁移、使用扩展提供的补全/格式化/数据库视图时，以扩展为准；**迁移与 generate** 仍以项目内 Prisma CLI 为准（例如 `bun --bun run prisma migrate dev`、`prisma generate`，见 `prisma.config.ts`）。

默认本地数据库 URL：`prisma.config.ts` / `lib/prisma.ts` 中 `DATABASE_URL` 未设置时为 `file:./data.db`（仓库根目录相对路径，已 `.gitignore`）。

## Import Alias

本项目配置了 TypeScript 路径别名，以简化导入路径。如果某个导入可以使用别名进行而没有使用，则视为「错误」的导入。

- `@/*` → `./app/*`
- `@lib/*` → `./lib/*`
- `~` → `./`

❌ 错误的导入：

```ts
import SomeComponent from '../../../../xxx'
import { getPrisma } from '../../..prisma/generated/prisma/client'
import { cn } from '../../lib/cn'
import prismaClient from '../../lib/prisma'
```

✅ 正确的导入：

```ts
import { cn } from '@lib/cn'
import prismaClient from '@lib/prisma'
import SomeComponent from '~/xxx'
```

## Next.js：动手前读文档，并与 Skills 配合

做任何 **Next.js 相关** 改动前，按下面顺序来，**不要只靠模型内置记忆**（容易与当前版本不一致）：

1. **本仓库 Skills：** 先打开与任务相关的 **`.agents/skills/`** 条目（尤其是 **`next-best-practices`**、**`next-cache-components`**），读 `SKILL.md` 及其中 `references/`、`rules/`，建立目录约定、RSC 边界、缓存等**工作方式**。
2. **已安装版本的官方说明：** 在 **`node_modules/next/dist/docs/`** 里找到与当前改动对应的说明并阅读，以**当前仓库锁定的 Next 版本**为准核对 API、配置与行为。
3. **再写代码或给方案：** Skills 负责「本仓库约定 + 实践清单」；**`node_modules/next/dist/docs/`** 负责「与安装版本一致的规范原文」。二者互补；若冲突，以本地文档为准。

## 本仓库内的 Agent Skills & MCPs（项目级）

以下罗列了本项目已经安装和配置的部分 Agent Skills & MCPs；执行任务时，应该阅读相关的文档与说明，不要仅凭过时记忆拼 API。**Next 任务**还须遵守上一节 **「Next.js：动手前读文档，并与 Skills 配合」** 中的顺序。

| 技能目录                        | 适用场景                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ai-sdk`                        | Vercel AI SDK：`streamText` / `generateText`、工具调用、`useChat`、Provider、结构化输出、Agent 编排等 |
| `next-best-practices`           | Next.js 目录约定、RSC 边界、数据获取、Route Handler、metadata、错误处理、图片/字体等通用实践          |
| `next-cache-components`         | Next 16+ Cache Components、`use cache`、`cacheLife` / `cacheTag`、PPR 相关                            |
| `vercel-react-best-practices`   | React / Next 性能、重渲染、数据与缓存、包体与加载等（Vercel 规则集）                                  |
| `vercel-composition-patterns`   | 组合式组件、减少 boolean props、Context、React 19 相关 API                                            |
| `vercel-react-view-transitions` | View Transition API、路由/列表过渡、`<ViewTransition>` 与 Next 集成                                   |
| `ast-grep`                      | 按 AST 结构搜索/盘点代码（复杂模式优于纯文本 grep）                                                   |

| MCP            | 适用场景                                                       |
| -------------- | -------------------------------------------------------------- |
| `ark-docs-mcp` | 字节火山云 MCP，用于查询火山云文档                             |
| `context7-mcp` | 用于查询框架类型文档的实用工具，查询框架文档时优于直接联网搜索 |

## 工作流

本项目使用 Compound Engineering（CE） 与 Superpowers（SP） 技能进行工作流管理。
工作时应当主动识别用户意图并且调用工作流内相关技能。
两个工作流存在较大功能重叠和冲突，以 CE 为主，SP 为补充。

## 实现时注意

- 对话页须支持用户切换：**LLM**（必选）、**主生图**（可选）、**次生图**（可选）；新对话初始三项均未选，**至少选定 LLM** 后即可发消息。未选主生图时 Agent 不持有任何生图工具，需在用户表达生图意图时通过文本回复告知能力缺失（不在产品层做硬闸阻塞）。详细工具暴露规则见 R3 / R9。
- **主 / 次生图语义**：两者为收费 / 能力不同的两条独立候选 Model，由 Agent 自由选择；产品层不规定 fallback / 主辅语义。
- **R15 生图确认**：内联于工具调用块、「确认 / 拒绝」二元按钮、**确认粒度=一次工具调用**（与产出图像数无关）；拒绝以「用户未批准」语义回传 Agent，不区分「跳过」。
- **R19 用户中断**：UI 推荐**发送 / 停止同按钮**按状态切换；中断时等待中的确认按「未批准」处理，正在跑的工具按工具失败处理。
- 上下文用量可视化：仅用 API 返回的 `usage` 更新，不做本地 token 估算；**不做 compact / 滑窗**，撞墙由 LLM API 报错经 R16 回传 Agent，再由文本告知用户。
- 生图参数（分辨率等）遵循各 Provider 声明的能力；不提供用户侧参考图张数上限配置（超张数时 UI 调用前阻塞提示）。
- **Search Model 配置**：与 LLM / 生图共用「Model」抽象但 schema 按 type 分支；Brave Search 密钥**强制**作为 Search Model record 在设置页配置，无环境变量 fallback。
- **密钥落库**：v1 接受明文（玩具 / 单机自用），加密 deferred。

## 测试与 TDD（默认）

- **纪律**：CE对测试先行只有弱提示；在本仓库内，对**可自动化验证的行为**（新功能、缺陷修复、重构、行为变更），默认遵循 **Superpowers `test-driven-development` 技能**的 TDD 哲学：先写**失败**测试并确认失败符合预期（RED），再写**最少**实现通过（GREEN），再重构（REFACTOR）；**未见过测试失败，不得认为测对了行为**。
- **与计划的关系**：若 `ce-plan` 中实现单元带有 `Execution note`（如 test-first、characterization-first），**以该 note 为准**，并与本节一并遵守（更具体、更严者优先）。
- **命令与栈**：`bun test`（Vitest）；组件测遵循 **Testing Library** 惯例。
- **务实豁免**（须在对话或 PR 中**简短声明**；拿不准时**不要**豁免，按 TDD 做）：
    - 纯样式 / 布局调整（如仅 Tailwind、daisyUI 类名）且无行为变化；
    - 仅改文案或注释；
    - 纯配置、生成物或脚手架（例如仅格式化、无新行为的迁移/配置），性质与 Superpowers 技能中「配置/生成代码」类例外一致且已由本仓库预先列明；
    - 用户或当前任务**明确**声明本次不写测试。

## 前端 / 代码风格

- 与现有 ESLint、TypeScript 配置保持一致；优先小步提交、避免无关重构。
- **Tailwind（`className`）**：拼条件类名、合并冲突工具类时统一使用 **`cn()`**（仓库根 `lib/cn.ts`，`clsx` + `tailwind-merge`；从 `app/` 内引用时用 `../lib/cn` 等相对路径），不要手写长模板字符串拼接或忽略冲突覆盖。
- 用户规则要求中文沟通时，文档与注释可按团队习惯中英并存；本文件以中文为主便于本地阅读。
