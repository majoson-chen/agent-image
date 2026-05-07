# Provider Register 多阶段计划总览

本文档说明 **4 份串行 Implementation Plan** 的执行顺序、与 [SPEC：Provider（Model）Register 架构与数据模型](../specs/2026-05-07-provider-register-architecture-spec.md) 的对应关系，以及跨计划依赖。

---

## 串行顺序（必须按序）

| 顺序 | 计划文件 | 覆盖 SPEC | 交付物 |
| --- | --- | --- | --- |
| 1 | [plan-01-schema-registry-and-data.md](./2026-05-07-provider-register-plan-01-schema-registry-and-data.md) | G1、G3、§4、§5、§10（Registry/迁移测试） | 新 `Model` 表形状、`registerId`+`config`、静态 Registry、DB 层 CRUD、数据迁移 |
| 2 | [plan-02-runtime-dispatch.md](./2026-05-07-provider-register-plan-02-runtime-dispatch.md) | G4（LLM/IMAGE/SEARCH 运行时）、§7、G5 局部 | Chat/工具链按 `registerId` 分发；移除对 `ProviderType` 列的运行时依赖 |
| 3 | [plan-03-settings-api-ui.md](./2026-05-07-provider-register-plan-03-settings-api-ui.md) | G2、§6 | 设置页三区 + Register 元数据列表 API + 动态配置 UI + 入库 |
| 4 | [plan-04-reference-errors-devtools.md](./2026-05-07-provider-register-plan-04-reference-errors-devtools.md) | G5 补全、G6、G8（§8）→ G7 | `resolveConversationImage`、可选参考图入参、结构化 tool 错误、`devToolsMiddleware` 开发门控 |

---

## 与 SPEC 自检项对照

- **目录真源唯一 / DB 仅存用户实例**：Plan 01–03（Registry 代码 + POST 只写用户配置行）。
- **设置校验 vs tool result**：Plan 03（HTTP 4xx/422）与 Plan 02/04（tool 内结构化结果）分工明确。
- **禁止 Register 互 import**：各计划在 `lib/providers/_internals/` 与 `lib/providers/registers/*` 的路径约定中遵守。
- **Import 别名**：所有新代码使用 `@lib/*`、`~/`；**不得**用 `@/*` 引用 `lib/` 下文件。

---

## 执行期风险（实现者必读）

1. **完成 Plan 01 后、Plan 03 前**：若已部署新 schema 但未更新设置页，仅靠旧 UI 可能无法创建模型。开发环境应 **连续执行** 或保留短寿分支避免长时间处于该状态。
2. **LLM `name` 语义变更**：SPEC 下 `name` 为用户标签；API 模型 id 迁到 `config`（见 Plan 01）。迁移须把 **旧行 `name` → `config.modelId`（或等价）**，避免对话突然指向错误模型。
3. **画布**：`canvases/` 中数据模型 / Provider 工厂相关画布在 Plan 02 后可能过期；SPEC 不要求本轮必改画布，但合并前建议人工对齐（见 AGENTS.md）。

---

## Self-review（计划族 vs SPEC）

| SPEC 目标 | 覆盖计划 |
| --- | --- |
| G1 静态 Registry | Plan 01 |
| G2 设置页三区 + 懒加载 UI | Plan 03 |
| G3 `registerId` + `config` | Plan 01 |
| G4 Register 产出 LLM/工具/搜索 | Plan 02（+ Plan 04 补 image 参考） |
| G5 结构化 tool 错误 | Plan 02 起式；Plan 04 收敛 |
| G6 参考图 + 内核 | Plan 04 |
| G7 DevTools | Plan 04 |

**非目标**（远程目录、config 加密等）四份计划均 **不** 引入新范围。
