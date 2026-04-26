# AGENTS.md：测试与 TDD 约定（设计说明）

## 背景

- Compound Engineering（`ce-plan` / `ce-work`）仅在用户或计划显式要求时强调 test-first，对 Agent 的**默认约束偏弱**。
- 本仓库已具备 **Vitest** 与 **Testing Library**（`bun test`）。
- 希望将 **Superpowers `test-driven-development` 技能**中的纪律（先失败测试、见红、最小实现、重构；「未见过失败则不知测的是否正确」）提升为**默认实现哲学**，同时保留务实豁免以免与纯样式/文案类改动冲突。

## 目标

在 `AGENTS.md` 中增加独立小节，使 Agent：

1. 对可测逻辑默认遵循 Superpowers TDD 哲学，并在会话中 **@** 该技能 `SKILL.md` 后再改实现代码。
2. 若 `ce-plan` 的 `Execution note` 更具体或更严，与本节**同时遵守**（取更严、更具体者）。
3. 在预先列出的豁免场景下可偏离完整红绿循环，但**须在对话或 PR 中声明**；存疑时优先 TDD。

## 非目标

- 不规定覆盖率阈值或强制目录结构。
- 不修改测试框架或 `package.json` 脚本。

## 拟插入 `AGENTS.md` 的章节（定稿）

见仓库 `AGENTS.md` 中 `## 测试与 TDD（默认）` 一节（实现与此处保持一致）。

## 自检

- 无 TBD：豁免列表与 CE / Superpowers 关系已写明。
- 一致性：B 类豁免与「优先 TDD / 存疑不写豁免」不矛盾。
- 范围：仅文档与协作约定，不涉及产品行为变更。
