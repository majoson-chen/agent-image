# Register / Kernel 彻底解耦 — 计划总览与执行顺序

> **For agentic workers:** 本分册 **无独立 Task**；按下列顺序执行各 plan 文件。每一步完成后 **`bun run test`** 须全绿再进入下一步。

**Goal:** 通过 Catalog Hook 收敛全部厂商特化，使 Chat / tools / settings 路径上的 **Kernel 无 `registerId` 硬编码分支**，并与 `docs/superpowers/specs/2026-05-08-register-hook-system-design.md` 对齐。

**Architecture:** 静态 **Catalog 单行**挂载 `llm.*`、`image.*`、`search.*` 钩子；Kernel 只做派发与共享基础设施（`_internals`、会话图像校验、DB）。

**Tech Stack:** Bun、Next.js App Router、Prisma、Vercel AI SDK v6 (`ai`、`ToolLoopAgent`、`tool`)、Vitest、`zod`。

---

## 权威文档（实施前通读）

| 文档 | 用途 |
| --- | --- |
| `docs/guides/register-system.md` | Agent 心智模型与必读锚点 |
| `docs/superpowers/specs/2026-05-08-register-hook-system-design.md` | Hook 能力 ID 与 Kernel 禁区 |
| `docs/superpowers/specs/2026-05-08-register-as-plugin-qualitative-standard.md` | 插件定性、一户一地 |
| `docs/superpowers/specs/2026-05-07-provider-register-architecture-spec.md` | G4/G6 总目标 |

---

## Plan 文件与依赖顺序（必须按序）

| 顺序 | 文件 | 交付物 |
| --- | --- | --- |
| 1 | [plan-01-catalog-hooks-core.md](./2026-05-08-register-kernel-decoupling-plan-01-catalog-hooks-core.md) | Hook 类型、`RegisterCatalogRow` 扩展、LLM 工厂并入 Catalog 行；无行为断裂 |
| 2 | [plan-02-llm-chat-provider-options.md](./2026-05-08-register-kernel-decoupling-plan-02-llm-chat-provider-options.md) | `llm.chatProviderOptions`；移除 Kernel 内 DashScope `Set` |
| 3 | [plan-03-image-tool-and-execution.md](./2026-05-08-register-kernel-decoupling-plan-03-image-tool-and-execution.md) | `image.tool` / `image.execution`；清空 `image-generate.ts` 与中央 factory |
| 4 | [plan-04-search-tools.md](./2026-05-08-register-kernel-decoupling-plan-04-search-tools.md) | `search.tools`；`tool-registry` 不再写死 Brave |
| 5 | [plan-05-settings-validation-single-source.md](./2026-05-08-register-kernel-decoupling-plan-05-settings-validation-single-source.md) | Settings fallback / IMAGE vendor 分叉 / POST schema 与 Catalog 同源 |
| 6 | [plan-06-registers-one-folder-per-sku.md](./2026-05-08-register-kernel-decoupling-plan-06-registers-one-folder-per-sku.md) | `lib/providers/registers/` 一户一地；import 修正 |
| 7 | [plan-07-canvas-sync.md](./2026-05-08-register-kernel-decoupling-plan-07-canvas-sync.md) | `canvases/*.canvas.tsx` 与 Hook / 工厂叙事一致 |

**说明：** Plan 06 可与 Plan 03–05 **并行不同分支**，合并前需 rebase；若单人串行，建议放在 Plan 05 之后以减少冲突。

---

## 全局门禁（合并前自检）

在 `lib/`、`app/api/`（不含 `app/settings` 内纯 UI 文案）执行检索：

```bash
rg "registerId\s*===|registerId\s*!==|switch\s*\(\s*registerId" lib app/api --glob '*.{ts,tsx}'
```

**允许残留：** `lib/providers/registry.ts`、`lib/providers/register-config.ts`、`lib/db/models.ts` 中与 **Catalog 查找** 相关的等价判断（计划收口后应仅剩「lookup」语义）。

**不允许：** `lib/tools/tool-registry.ts`、`lib/tools/image-generate.ts`、`lib/image-provider-factory.ts`、`lib/llm-chat-provider-options.ts`（Plan 02–04 后应删除或变为薄 re-export）中出现厂商专用分支。

---

## Self-review（本分册）

- **Spec 覆盖：** Hook SPEC H1–H4 映射到 Plan 01–05。
- **占位符：** 无。
- **一致性：** `llm.chatProviderOptions` 命名与 Hook SPEC §4.2 一致。

---

## 执行交接（writing-plans 要求）

**Plan 全集已落盘于 `docs/superpowers/plans/2026-05-08-register-kernel-decoupling-plan-*.md`。**

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 独立 subagent + task 间 review；技能：`superpowers:subagent-driven-development`。
2. **Inline Execution** — 本会话或 dedicated worktree 按 Task 顺序执行；技能：`superpowers:executing-plans`。

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-08 | 初版：总览与 plan 索引 |
