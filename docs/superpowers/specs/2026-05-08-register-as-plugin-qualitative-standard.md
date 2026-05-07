# SPEC 补充：Register 作为插件系统（定性标准与布局约定）

## 文档状态

- **类型**：对 [Provider Register 架构 SPEC](./2026-05-07-provider-register-architecture-spec.md) 的 **补充与细化**，不改变其 G1–G7 目标，只约定 **语义边界** 与 **工程布局**。
- **用途**：此后新增/改写 Register 或与 Kernel 交界处代码时，以本文 **自检**；Agent 与人类检索关键字：`plugin`、`Register 定性`、` Kernel 禁区`。

---

## 1. 定性：Register = 插件，Kernel = 宿主

| 角色                  | 职责（应当）                                                                                                                         | 禁止（原则上）                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Kernel**            | 会话与存储边界、通用工具协议、调用 **Catalog 钩子**、`parseModelConfig` 的失败语义、不涉及具体厂商的请求/响应字段                    | 写死某一厂商 URL、专有 JSON 路径、Brave/DashScope/Seedream 等 **特化分支**（除通过 Register 钩子间接执行） |
| **Register（插件）**  | 该 SKU 的 **config Zod schema**、默认值与文档链接、（按类型）**LanguageModel 工厂 / 生图执行体 / 搜索工具工厂 / ProviderOptions 等** | 依赖另一条 Register 的 **整条 SKU 定义**（见 §3）                                                          |
| **Catalog（聚合表）** | 静态列出 `registerId` → 元数据 + schema + **可选运行时钩子**；这是 **唯一允许的「硬编码列表」**                                      | 在 Catalog 内实现具体 HTTP 或解析逻辑（应委托给 Register 模块）                                            |

**说明**：当前代码与上述标准 **仍有差距**（例如生图 HTTP 仍集中在 Kernel 侧文件），属于 **已知技术债**；新代码应 **向此标准收敛**，旧代码按增量重构迁移。

---

## 2. 插件契约（标准能力面，可逐步补齐）

一条 Register 在类型上可能提供以下能力（**按需实现**，非全套必选）：

1. **元数据**：`registerId`、`modelType`、标题、描述、排序（与现有 `RegisterMetadata` 一致）。
2. **配置**：Zod schema + 派生 TypeScript 类型；**唯一**解析入口仍经 `parseModelConfig(registerId, raw)`。
3. **LLM**：`buildLanguageModel(record)`（或等价），仅依赖已解析 config / Prisma `Model` 行。
4. **IMAGE**（目标态）：`executeImageGeneration(ctx)` 或与工具系统对齐的工厂，**封装**该 SKU 的 HTTP、响应解析、错误映射。
5. **SEARCH**（目标态）：`buildSearchTools(config)` 或返回 API key + 工具模板，**不**在 `tool-registry` 内写 Brave 特化。
6. **横向选项**（目标态）：如 `computeChatProviderOptions(model)`，避免在 Kernel 内维护 `Set<registerId>` 式的 thinking 白名单。

**演进规则**：每从 Kernel 迁出一条厂商特化逻辑，对应 Register 增加 **一档契约**并在 Catalog 登记；Catalog 只做 **派发**，不长业务实现。

---

## 3. 共享代码与「复用」（与 SPEC §4.1 的关系）

- **允许**：
    - `lib/providers/_internals/` 中的 **与 SKU 无关** 的可复用实现（HTTP 辅助、与 AI SDK 的薄封装等）。
    - **厂商级或能力级共享模块**：例如 `alibaba-dashscope-shared.ts`、`openai-compat-*.ts`，被 **多条** Alibaba/DashScope SKU **共同 import**。
    - Kimi K2.6 **复用** Alibaba 连接配置与 LanguageModel 构建方式 ⇒ 通过 **共享模块**，而非 `import '../alibaba-dashscope-llm'` 把「另一条 Register」当库用。

- **不推荐 / 应避免**：
    - Register A **直接依赖** Register B 的「默认导出 SKU 定义」文件（易产生隐式 SKU 耦合与循环依赖）。

- **与 SPEC 「Register 互不 import」的表述对齐**：互不 import 指的是 **SKU 条目之间**；**Vendor 共享包**与 **\_internals** 不在此禁止之列。

---

## 4. 布局约定：**一户一地**，禁止根目录散装

### 4.1 目标形态

- 每个 `registerId` 对应 **`lib/providers/registers/` 下的唯一前缀**（**一户一地**）：
    - **首选**：`registers/<slug>/index.ts` 作为 **单一对外的叙述入口**（schemas、常量、服务端工厂可在同目录子文件中 **被 index 聚合 re-export**，但 **不在 `registers/` 根下列出多个并列文件**）。
    - **若团队坚持「物理单文件」**：允许 `registers/<slug>.ts` **仅在**无任何 Client/Server 拆包冲突时使用；一旦出现 `'server-only'` 与客户端可引 schema 的冲突，应 **升格为同名目录**，由 `schema.ts` + `runtime.server.ts` + `index.ts` 收口，而非在根目录增加 `slug.llm-runtime.ts`。

### 4.2 反模式（现行代码中仍存在，新发 PR 应避免加重）

- 在 `registers/` **根目录** 同时存在 `foo.ts` 与 `foo.llm-runtime.ts` 等多枚兄弟文件 —— 阅读与检索时 **不像「一条 Register」**。

### 4.3 设置 UI

- 表单单文件可留在 `app/settings/register-forms/`（产品层）；其 **config 形状** 以 Register 的 Zod 类型为 **单一真源**，避免 UI 与 Register 两套校验漂移。

---

## 5. 自检清单（Code Review / Agent）

- [ ] 本次改动是否在 Kernel 新增了 **可查的厂商名字符串** 或专有 URL？若 yes，能否下放到 Register？
- [ ] 新增 SKU 是否在 Catalog 注册，且 **没有在 `tool-registry` / `image-provider-factory` 等处再写一组平行分支？**
- [ ] 共享逻辑是否落在 **vendor-shared / \_internals**，而非「Register import 另一条 Register」？
- [ ] 新 Register 的路径是否符合 **§4「一户一地」**？

---

## 6. Related

- **Agent 面向总览（工作逻辑 + 开发清单）**：[`docs/guides/register-system.md`](../../guides/register-system.md)
- 主 SPEC：[2026-05-07-provider-register-architecture-spec.md](./2026-05-07-provider-register-architecture-spec.md)
- **Hook 系统设计（术语与能力 ID）**：[`2026-05-08-register-hook-system-design.md`](./2026-05-08-register-hook-system-design.md)
- Plan 总览：[2026-05-07-provider-register-plans-overview.md](../plans/2026-05-07-provider-register-plans-overview.md)
- Compound 简述：[docs/solutions/architecture-patterns/model-registerid-config-register-metadata-2026-05-07.md](../../solutions/architecture-patterns/model-registerid-config-register-metadata-2026-05-07.md)

---

## 文档修订记录

| 日期       | 说明                                               |
| ---------- | -------------------------------------------------- |
| 2026-05-08 | 初稿：插件定性、契约面、共享边界、一户一地目录约定 |
| 2026-05-08 | Related 增加 Hook 系统设计链接                     |
