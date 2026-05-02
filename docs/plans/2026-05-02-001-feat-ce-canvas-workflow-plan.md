---
title: "feat(docs): CE 工作流接入 Cursor Canvas 约定"
type: feat
status: active
date: 2026-05-02
---

# feat(docs): CE 工作流接入 Cursor Canvas 约定

## Overview

在 **不改动 Next.js 应用代码** 的前提下，将 **Cursor Canvas**（`cursor/canvas` + `.canvas.tsx`）明确为 Compound Engineering（CE）链路中的 **可选可读交付物**：由 `ce-plan`/`ce-work` 定义何时产出，由 IDE 侧边打开；素材来自本仓库既有 `docs/plans/`、`docs/brainstorms/` 与实现代码。**权威文档仍以仓库内 Markdown 为准**；Canvas 为导航式导读层。

---

## Problem Frame

- CE 主导计划、文档与代码，但 Agent 对人类协作者的 **架构/对齐界面** 未在 AGENTS 中写明，易产生「只靠聊天长篇输出」而与计划脱节。
- 需在 **AGENTS.md** 中写明：何时读取 `canvas` / `docs-canvas` skill、`canvases/` 的路径约束、以及如何写进计划的 Implementation Unit。

---

## Requirements Trace

- R1. `AGENTS.md` 在 **工作流** 章节增加可读小块，描述 CE 各阶段如何把 Canvas 作为可选工件与 Markdown 文档并列。
- R2. 明确 Canvas **不是** Next 路由或 `app/` 代码；单行说明默认文件位置（Cursor 托管的 `canvases/`），避免误以为要配 import alias。
- R3. 指向执行时应遵循的 Skill：`canvas`（必读本仓库规则中的画布技能）、`docs-canvas`（文档排版地板：Overview / TOC / 正文 / References）。
- R4. 说明与 **LFG**（plan → work → review）相容：计划中可单列 Canvas 相关 Implementation Unit，`Verification` 以「可打开且与来源文档一致」为主，不要求 Vitest。

---

## Scope Boundaries

- **非目标**：在本仓库提交任何 `.canvas.tsx`（Canvas 默认在 IDE 托管目录，是否同步入 git 由团队另行约定）。
- **非目标**：实现应用内嵌 Canvas Viewer 或新依赖。

---

## Context & Research

- 对话共识：计划/文档/代码均由 CE 驱动；Canvas 由 CE **搜集信息后**按计划交付。
- Cursor：`~/.cursor/skills-cursor/canvas/SKILL.md` 约束单文件、`cursor/canvas`、无 `fetch`。
- Docs Canvas 插件：`docs-canvas` skill 给出文档类布局提纲。

---

## Implementation Units

- [x] U1. **扩充 AGENTS.md 工作流说明**

**Goal：** 落实 R1–R4，使本仓库 Agent 在执行 CE 时能主动对齐 Canvas 技能与工件边界。

**Requirements：** R1、R2、R3、R4

**Dependencies：** 无

**Files:**

- Modify: `AGENTS.md`

**Approach:**

- 在 `## 工作流`（CE/SP 段落后）追加子节「CE 与 Cursor Canvas」：触发条件、与大功能/`ce-plan`/`ce-work`的衔接、`Verification`示例一句、以及与 Markdown 权威的层次关系。

**Patterns to follow:**

- 与现有 AGENTS 列表风格一致（短句、` **加粗 ** ` 少用，与上文「实现时注意」区分开）。

**Test scenarios:**

- 无自动化测试；人工核对 R1–R4 均被段落覆盖。

**Verification:**

- `AGENTS.md` 含 CE + Canvas 小节，且不误导为 Next 内置功能路径。

---

## Verification（计划级）

- 通读新增的 `AGENTS.md` 小节，确认无绝对路径硬性写死（可用「Cursor 托管的 `canvases/`」类描述）。
- **务实豁免（TDD）**：纯文档约定扩展，无可自动化断言行为。
