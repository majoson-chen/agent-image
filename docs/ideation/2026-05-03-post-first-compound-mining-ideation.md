---
date: 2026-05-03
topic: post-first-compound-mining
focus: 首例 ce-compound 后，从工作区与对话记录检索可沉淀到 docs/solutions 的内容；代码已多、此前未系统做过 compound
mode: repo-grounded
---

# Ideation: 首例 compound 后的「采矿」与沉淀优先级

## Grounding Context

### Codebase Context（Phase 1 合并摘要）

- **形状：** agent-image 为 Next.js + Bun 单机对话/生图 Agent；`docs/solutions/` 目前仅 1 篇 compound（Canvas 放仓库根 `canvases/` 的约定）；`docs/plans/`、`docs/brainstorms/` 体量远大于 solutions。
- **缺口：** 行为真相高度集中在 `app/api/chat/route.ts`、`lib/tools/tool-registry.ts`、`lib/ai/build-agent.ts`（ToolLoopAgent）、生图 Provider 工厂与 Prisma 枚举，但未以可检索 institution 文档形式落盘。
- **一致性与漂移：** `AGENTS.md` 仍将 Vercel AI SDK 描述为「规划」，与已落地的 `ToolLoopAgent` / `useChat` 等实现不完全一致；schema 注释与 UI 行为存在误读风险。
- **计划牵引：** `docs/plans/2026-04-29-002-feat-agent-tools-m2-engineering-plan.md` 等多处预告 M2 后应在 `docs/solutions/` 补「AI SDK 工具循环 + 中断」等短篇；与当前 solutions 稀疏形成落差。
- **首例 compound 样本：** `docs/solutions/conventions/repo-local-cursor-canvas-canvases-2026-05-03.md` 确立了 YAML frontmatter、`conventions/` 子目录等写法，可作为后续 solutions 的格式锚点。

### Past Learnings

- 已有一篇 **Canvas 路径与人类文档载体** 的约定 compound；与 **运行时工具暴露、chat 契约、审批/中断** 等行为级 knowledge 尚无对应 solutions。
- Brainstorm / multimodal 等文档叙事已丰富，**晋升为 solutions 的通道**仍弱。

### External Context

- 优先 **风险地图 + runbook 式短条**；从会话中蒸馏 **纠正句、最终决定、可验证步骤**，避免 **全文聊天记录** 入库。
- **值得沉淀信号：** 重复疑问、高代价错误、与框架默认相反的仓库级约定、难回滚/不可逆操作、仅少数人掌握的排障启发式。

## Ranked Ideas

### 1. 行为真相索引（Chat / ToolRegistry / BuildAgent）

**Description:** 维护一页可 grep 的索引：模块 → 职责一句 → 关键源码路径；与 `docs/plans/` 并排存在，不复制长篇计划正文。

**Rationale:** 调试与续作以代码为锚；减少「plan 很多、仍不知从哪打开代码」的摩擦。

**Downsides:** 若重构不及时更新，索引会变成 stale list。

**Confidence:** 82%

**Complexity:** Low

**Status:** Unexplored

### 2. M2 对齐的最小 compound 集（工具循环 · 中断 · 确认）

**Description:** 撰写 3–5 条极短 `docs/solutions/`：流/取消边界、用户中断时待确认项的语义、工具失败如何回传 Agent；每条绑定具体文件/函数名。

**Rationale:** 与现有 M2 计划表述一致；填补 agent 可检索层的空白。

**Downsides:** 需与实现对齐，错误叙述的伤害大；可能需多轮修订。

**Confidence:** 78%

**Complexity:** Medium

**Status:** Unexplored

### 3. Canvas ↔ solutions 单向引用契约

**Description:** 约定 Canvas 侧重人类结构与愿景，仅链到 `docs/solutions/*.md`；**事实与契约**写在 solutions（可选 frontmatter `human_canvas:` 回指画布节点）；减少双源叙事漂移。

**Rationale:** 与 AGENTS 已强调的 `canvases/` 分工一致，并针对「画布易与实现不一致」的风险。

**Downsides:** 依赖执行纪律；弱违反时不易自动发现。

**Confidence:** 75%

**Complexity:** Low

**Status:** Unexplored

### 4. 会话采矿 SOP：决策账本 + 时间上限

**Description:** 会话收尾用固定模板抽取 **症状 / 结论 / 代码锚点**；单次「考古」≤15 分钟；可选用 `ce-session-inventory` 列出近期会话后 **人工勾选** 入库，禁止粘贴整段 transcript。

**Rationale:** 响应「工作区 + 对话记录」诉求，同时控制噪声与维护成本。

**Downsides:** 仍依赖个人习惯；需要练习才能稳定产出。

**Confidence:** 70%

**Complexity:** Low

**Status:** Unexplored

### 5. 契约即测试（chat POST / parts）

**Description:** 为 `chat` POST schema、UIMessage / parts 形状增加 characterization 或 snapshot，契约变更必须显式更新测试。

**Rationale:** 与仓库默认 TDD 一致；可执行契约降低长文 API 说明的负担（类比 SRE 的可执行 runbook）。

**Downsides:** 测试有维护成本；首写需要投入。

**Confidence:** 74%

**Complexity:** Medium

**Status:** Unexplored

### 6. AGENTS.md 真相更正 + 漂移登记

**Description:** 维护一小节或独立表：过时表述（例如 AI SDK「规划」）→ 更正句 + 链接到实现或 solution；可作为独立小 PR 完成。

**Rationale:** 入口文档错误会让人与下一轮 agent 从错误心智模型出发。

**Downside:** 属于 hygiene，需随实现持续扫。

**Confidence:** 85%

**Complexity:** Low

**Status:** Unexplored

## Rejection Summary

| #   | Idea                                                  | Reason Rejected                                                 |
| --- | ----------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Doc-gap 全量 CI lint                                  | 首期实现与维护成本高；在索引稳定后再加自动化更划算              |
| 2   | 全自动「会话 → JSON 队列」                            | 噪声大；半自动勾选更匹配单人维护                                |
| 3   | 过重 frontmatter 扩展（多级标签、compounding 字段等） | YAGNI；沿用首例 compound 范式即可迭代                           |
| 4   | Provider 工厂 codegen / 大矩阵生成                    | 偏窄，优先度低于核心 chat/工具链契约                            |
| 5   | Plans ↔ 实现 staleness 全自动脚本                     | 有益但次于「行为真相」与 M2 短篇落地                            |
| 6   | 极端「禁止任何长文」政策                              | 与 compound 需要可复述上下文相冲突；采用「默认短文 + 深链」更稳 |

## Recommended next step

`/ce-brainstorm` — 从上面 **任选一条**（建议从 #1 索引或 #6 AGENTS 更正开始低成本启动）细化成可执行的需求/范围，再进入 `ce-plan`。
