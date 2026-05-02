---
title: "refactor: System prompt 迁入 Mustache 文本模板"
type: refactor
status: active
date: 2026-05-01
---

# refactor: System prompt 迁入 Mustache 文本模板

## Overview

将 `buildSystemPrompt` 中冗长的内联模板字符串迁出到仓库内的文本文件，用已安装的 `mustache`（^4.2.0）渲染。行为与现有产品规则（工具列表、生图状态、固定说明文案）保持一致；以 `tests/ai/system-prompt.test.ts` 的断言为回归基准。

---

## Problem Frame

- **维护成本**：`lib/ai/system-prompt.ts` 单文件混杂 Markdown 结构与条件逻辑，diff 噪声大、难以在编辑器中整段审阅。
- **目标**：提示词主体在独立 `.txt`（内写 Mustache 占位符）中维护；TypeScript 只负责拼装 view（如工具列表、布尔条件）与渲染。

---

## Requirements Trace

- R1. 渲染结果在语义上与当前 `buildSystemPrompt` 一致，现有 `tests/ai/system-prompt.test.ts` 全部通过（允许仅因无害空白产生的有意更新，但应尽量避免）。
- R2. 模板与渲染逻辑仅在服务端使用；保持 `import 'server-only'` 边界。
- R3. 动态插入内容不得因 Mustache 默认 HTML 转义破坏原文（例如将来若向 view 传入含 `&`、`<` 的片段，须使用 `{{{...}}}` 或等价策略；当前以「静态文案在模板文件中、动态项为纯工具名列表 + 布尔分段」为主）。
- R4. 本地开发与 Vitest 下均能可靠加载模板文件路径（见技术决策）。

---

## Scope Boundaries

- **非目标**：改写需求文档中的 R3/R9/R14 等产品措辞（除为适配 Mustache 语法必须的转义外，正文与现网一致）。
- **非目标**：把每条工具的说明改从 `tool-registry` 元数据自动生成（可作为后续迭代；本计划只做「迁出 + 渲染」）。
- **非目标**：引入 partial 文件拆分，除非实施中发现单文件过长难以编辑（默认单文件足够）。

---

## Context & Research

### Relevant Code and Patterns

- `lib/ai/system-prompt.ts` — 当前唯一拼装入口；`app/api/chat/route.ts` 调用 `buildSystemPrompt(descriptors)`。
- `tests/ai/system-prompt.test.ts` — 子串断言覆盖生图可用性、告知模板、`image-fetch` 长说明等。
- 依赖已在 `package.json`：`mustache`、`@types/mustache`。

### Key Technical Decisions

- **模板位置**：新建目录 `lib/ai/prompts/`，主文件建议 `system.mustache.txt`（扩展名标明含 `{{ }}` 语法；若你更偏好纯 `.txt` 亦可，但需在注释或 README 片段中标明为 Mustache）。
- **加载方式**：在 server-only 模块内使用 `readFileSync` + 与仓库根目录锚定的路径（例如 `join(process.cwd(), 'lib/ai/prompts/system.mustache.txt')`），并在模块级缓存模板字符串，避免每轮请求重复读盘。Vitest 默认 `cwd` 为项目根时与 Next 本地开发一致；若将来部署工作目录不同，再评估 `import.meta.url` 相对路径或构建期拷贝（本计划以当前单机/常规 Next 部署为假设）。
- **View 形状**：至少包含 `toolList`（与现实现相同：多行 `  - name` 或空列表占位句）。生图可用性可用 `{{#hasPrimary}}` / `{{^hasPrimary}}` 等 Mustache section，或继续在 TS 中拼好两行再传入 `{{{line}}}` — 优先 section，减少 TS 内的中文字符串重复。
- **转义**：工具名列表使用 `{{toolList}}` 通常足够；若整段为预格式化多行文本且含反引号或 `}`，保持该段在静态模板中，勿经错误转义的变量注入。

---

## Open Questions

### Resolved During Planning

- **是否还要先写 requirements 文档**：否，范围与成功标准已由对话与现有测试锁定。

### Deferred to Implementation

- 若 `next build` 后运行时 `cwd` 非仓库根导致读文件失败，再改为相对 `import.meta.url` 或 Next 约定的资源处理方式（实施时以一次 `bun run build && bun run start` 烟测验证）。

---

## Output Structure

```
lib/ai/prompts/
  system.mustache.txt   # 全文模板（从现有 system-prompt 迁出）
lib/ai/system-prompt.ts # 加载、view、Mustache.render
```

---

## Implementation Units

- [ ] U1. **新增模板文件并迁出正文**

**Goal：** 将当前 `buildSystemPrompt` 返回字符串中的静态 Markdown 迁入 `lib/ai/prompts/system.mustache.txt`，用 Mustache 占位符与 section 表达 `toolList` 与生图两行状态。

**Requirements：** R1、R4

**Dependencies：** 无

**Files:**

- Create: `lib/ai/prompts/system.mustache.txt`
- Modify: `lib/ai/system-prompt.ts`（可暂留占位实现待 U2 接好；或 U1+U2 同一提交内完成则以最终状态为准）

**Approach:**

- 从文面与换行上与现实现保持一致；`toolList` 的生成逻辑可先仍留在 TS（与今日相同），通过 `{{toolList}}` 注入。

**Patterns to follow:**

- 现有措辞以 `lib/ai/system-prompt.ts` 为单一来源做逐段搬迁，避免手打引入差异。

**Test scenarios:**

- Test expectation: none for this unit if 仅新增未接线文件；若 U1/U2 合并，则依赖 U3 的测试运行。

**Verification:**

- 人工 diff 对照旧字符串与模板内容（除占位符外）一致。

---

- [ ] U2. **实现加载、view 与 Mustache 渲染**

**Goal：** `buildSystemPrompt(availableTools)` 读模板（带缓存）、构造 view、返回 `Mustache.render` 结果。

**Requirements：** R1、R2、R3、R4

**Dependencies：** U1

**Files:**

- Modify: `lib/ai/system-prompt.ts`

**Approach:**

- 模块顶层 `let cachedTemplate: string | null`，首次调用时 `readFileSync`。
- `availableTools` 派生 `hasPrimary` / `hasSecondary` 与 `toolList`，传入 `Mustache.render`。
- 读取失败时应显式抛出（不静默返回空 prompt），便于启动或测试立刻暴露。

**Execution note:** 以现有测试为表征，先确认基线全绿再改渲染路径，改动后仍全绿。

**Patterns to follow:**

- `import 'server-only'` 保留在文件顶部；路径使用 `path.join(process.cwd(), ...)`。

**Test scenarios:**

- Happy path：`buildSystemPrompt` 与现用例相同的输入下，输出仍包含 `tests/ai/system-prompt.test.ts` 中断言的关键子串。
- Edge case：`buildSystemPrompt([])` 时空工具列表与「当前无任何可用工具」文案。
- Error path：模板文件缺失或不可读时抛出（可新增极小单测：mock 或临时改路径，可选；若实施成本过高则依赖启动烟测与代码审查）。

**Verification:**

- `bun test tests/ai/system-prompt.test.ts` 通过；`eslint` 无新问题。

---

- [ ] U3. **收尾与验证**

**Goal：** 全量测试与类型检查无回归；确认 chat 路由未改调用方式。

**Requirements：** R1

**Dependencies：** U2

**Files:**

- 视情况 Modify: `tests/ai/system-prompt.test.ts`（仅当模板迁移动了不可见字符或空格导致断言失败时微调）
- 只读核对: `app/api/chat/route.ts`（应仍仅 `buildSystemPrompt(descriptors)`）

**Test scenarios:**

- Integration：可选跑 `bun test` 全量（与 AGENTS.md 一致）。

**Verification:**

- `bun test`；`bun run lint`（或项目常用检查）无 error。

---

## System-Wide Impact

- **Interaction graph：** 仅 `buildSystemPrompt` 内部实现与新增模板文件；`handleChatPost` 行为不变。
- **Unchanged invariants：** 对外仍导出 `buildSystemPrompt(availableTools: string[]): string`，签名不变。

---

## Risks & Dependencies

| Risk                                 | Mitigation                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| 运行时 `cwd` 非仓库根导致读模板失败  | 实施后用 `next start` 烟测；失败则改 `import.meta.url` 基路径或其它 Next 兼容加载方式 |
| Mustache `{{ }}` 与正文中的 `{` 冲突 | Mustache 使用 `{{!` 注释或调整文案；正文大段保持静态不插变量                          |

---

## Sources & References

- 上游讨论：会话中确认的 Mustache + 文本模板方案；依赖 [janl/mustache.js](https://github.com/janl/mustache.js)。
- 相关代码：`lib/ai/system-prompt.ts`，`tests/ai/system-prompt.test.ts`，`app/api/chat/route.ts`。
