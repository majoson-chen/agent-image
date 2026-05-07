# Provider Register — Plan 01：Schema、Registry 与数据迁移

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `Model` 表迁移为 SPEC 目标形态（`registerId` + `config`），并实现 **静态 Registry**（元数据枚举 + 按 id 取 Zod 校验器），同步改造 `lib/db/models.ts` 与相关测试。

**Architecture:** Prisma 单层迁移（SQLite）在 **保留 FK 引用 `Model.id`** 的前提下扩容/回填/删列；运行时目录为 `lib/providers/registry.ts` 聚合；每种 SKU 的实现放在 `lib/providers/registers/<segment>.ts`（**禁止** Register 文件互相 import）；仅共享工具入 `lib/providers/_internals/`。

**Tech Stack:** Prisma 6、SQLite、`zod`、`vitest`、`bun run test`

---

## 文件结构（本计划）

| 路径 | 职责 |
| --- | --- |
| `prisma/schema.prisma` | `Model` 去掉 `providerType` 及各分散列，改为 `registerId` + `config`；若 `ProviderType` enum 已无引用则 **删除 enum** |
| `prisma/migrations/<stamp>_model_register_config/migration.sql` | **手写**回填 SQL + `DROP COLUMN`（SQLite ≥3.35）或等价安全流程 |
| `lib/providers/types.ts` | `RegisterId`、`RegisterMetadata`、`ModelType` 与 Prisma `ModelType` 对齐的类型 |
| `lib/providers/registry.ts` | `REGISTER_METADATA`、`listRegisterIds(modelType)`、`parseModelConfig(registerId, unknown)`、`assertKnownRegister(id)` |
| `lib/providers/_internals/json.ts` | `toInputJson(prisma)` 等小工具（如无必要可并入 registry） |
| `lib/providers/registers/openai-official.ts` | `metadata` + `configSchema`（Zod） |
| `lib/providers/registers/openai-compatible-generic.ts` | 同上 |
| `lib/providers/registers/alibaba-dashscope-llm.ts` | 同上（承载原 `supportsThinking` 能力字段，放入 `config.capabilities`） |
| `lib/providers/registers/brave-search.ts` | 同上 |
| `lib/providers/registers/volcengine-seedream.ts` | `config` 含 `requestModel`（替代原 **`Model.name` 用作 Seedream POST `model` 字段**）+ `capabilities` |
| `lib/providers/registers/dashscope-wan-image.ts` | 同上 |
| `lib/db/models.ts` | 改为 `upsert`/ `createModel` / `updateModelPatch`：**一律**经由 `parseModelConfig`；删除 `providerType` 分支 |
| `tests/providers/registry.test.ts` | Registry 纯逻辑测试 |
| `tests/db/models.test.ts` | 重写为 **`registerId`+`config`** 创建/更新语义 |

---

### Task 1: Registry 常量与按类型枚举（不写 DB）

**Files:**

- Create: `lib/providers/types.ts`
- Create: `lib/providers/registry.ts`
- Create: `tests/providers/registry.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/providers/registry.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { listRegisterMetadata, REGISTER_IDS } from '@lib/providers/registry'

describe('registry metadata', () => {
    it('lists only LLM registers for LLM', () => {
        const ids = listRegisterMetadata('LLM').map(m => m.registerId)
        expect(ids).toContain('openai/official')
        expect(ids.every(x => REGISTER_IDS.includes(x))).toBe(true)
        expect(ids).not.toContain('brave/search')
    })
    it('lists brave under SEARCH only', () => {
        expect(listRegisterMetadata('SEARCH').map(m => m.registerId)).toContain('brave/search')
    })
})
```

- [ ] **Step 2: 运行确认 RED**

运行: `bun run test -- run tests/providers/registry.test.ts`

预期: **FAIL**（模块不存在或未导出 `REGISTER_IDS` / `listRegisterMetadata`）。

- [ ] **Step 3: 最小实现**

`lib/providers/types.ts`:

```typescript
import type { ModelType } from '~/generated/prisma/client'

/** 对应 DB `Model.registerId` 与静态目录，必须使用小写 + `/`（SPEC §4.2） */
export type RegisterId = string & { readonly __brand: 'RegisterId' }

export interface RegisterMetadata {
    registerId: RegisterId
    modelType: ModelType
    /** 设置页下拉展示用 */
    title: string
    description?: string
    /** 同级别排序，越小越靠前 */
    sortOrder: number
}
```

`lib/providers/registry.ts`:

```typescript
import type { ModelType } from '~/generated/prisma/client'
import type { RegisterMetadata, RegisterId } from '@lib/providers/types'

const METADATA: readonly RegisterMetadata[] = [
    { registerId: 'openai/official' as RegisterId, modelType: 'LLM', title: 'OpenAI 官方', sortOrder: 10 },
    { registerId: 'openai-compatible/generic' as RegisterId, modelType: 'LLM', title: 'OpenAI 兼容（通用）', sortOrder: 20 },
    { registerId: 'alibaba/dashscope-llm' as RegisterId, modelType: 'LLM', title: '阿里云 DashScope LLM', sortOrder: 30 },
    { registerId: 'brave/search' as RegisterId, modelType: 'SEARCH', title: 'Brave Web/Image Search', sortOrder: 10 },
    { registerId: 'volcengine/seedream' as RegisterId, modelType: 'IMAGE', title: '火山方舟 Seedream', sortOrder: 10 },
    { registerId: 'dashscope/wan-image' as RegisterId, modelType: 'IMAGE', title: 'DashScope 万相图像', sortOrder: 20 },
] as const

export const REGISTER_IDS: RegisterId[] = METADATA.map(m => m.registerId)

export function listRegisterMetadata(modelType: ModelType): RegisterMetadata[] {
    return METADATA.filter(m => m.modelType === modelType).slice().sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getRegisterMetadata(registerId: string): RegisterMetadata | undefined {
    return METADATA.find(m => m.registerId === registerId)
}
```

（`parseModelConfig` 在 Task 2 再加，本 Task 不测。）

- [ ] **Step 4: GREEN**

运行: `bun run test -- run tests/providers/registry.test.ts`

预期: **PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/providers/types.ts lib/providers/registry.ts tests/providers/registry.test.ts
git commit -m "feat(providers): add static registry metadata (plan-01)"
```

---

### Task 2: 每 SKU 的 `configSchema` 与 `parseModelConfig`

**Files:**

- Create: `lib/providers/registers/openai-official.ts`
- Create: `lib/providers/registers/openai-compatible-generic.ts`
- Create: `lib/providers/registers/alibaba-dashscope-llm.ts`
- Create: `lib/providers/registers/brave-search.ts`
- Create: `lib/providers/registers/volcengine-seedream.ts`
- Create: `lib/providers/registers/dashscope-wan-image.ts`
- Modify: `lib/providers/registry.ts`（挂接 Zod、`parseModelConfig`、`defaultConfig` 可选）

- [ ] **Step 1: 写失败测试**

在 `tests/providers/registry.test.ts` 追加:

```typescript
import { parseModelConfig } from '@lib/providers/registry'

it('parses openai official config', () => {
    const c = parseModelConfig('openai/official', { modelId: 'gpt-4o', apiKey: 'sk' })
    expect(c).toMatchObject({ modelId: 'gpt-4o', apiKey: 'sk' })
})

it('rejects invalid openai compatible (missing baseURL)', () => {
    expect(() =>
        parseModelConfig('openai-compatible/generic', { modelId: 'x', apiKey: 'k' }),
    ).toThrow()
})
```

- [ ] **Step 2: RED**

运行: `bun run test -- run tests/providers/registry.test.ts`

预期: **FAIL**（`parseModelConfig` 未实现或抛错不符合预期）

- [ ] **Step 3: 实现各 Register 的 Zod + 聚合**

示例 `lib/providers/registers/openai-official.ts`:

```typescript
/**
 * Register：openai/official — OpenAI 官方 API（原 ProviderType OPENAI）
 */
import { z } from 'zod'

export const openaiOfficialConfigSchema = z.object({
    /** 调用 `createOpenAI(...).languageModel(modelId)` 的模型名 */
    modelId: z.string().min(1),
    apiKey: z.string().min(1),
})

export type OpenaiOfficialConfig = z.infer<typeof openaiOfficialConfigSchema>
```

`lib/providers/registers/openai-compatible-generic.ts`:

```typescript
/**
 * Register：openai-compatible/generic
 */
import { z } from 'zod'

export const openaiCompatibleGenericConfigSchema = z.object({
    modelId: z.string().min(1),
    baseURL: z.string().url(),
    apiKey: z.string().min(1),
    extraHeaders: z.record(z.string(), z.string()).optional(),
})

export type OpenaiCompatibleGenericConfig = z.infer<typeof openaiCompatibleGenericConfigSchema>
```

`lib/providers/registers/alibaba-dashscope-llm.ts`:

```typescript
/**
 * Register：alibaba/dashscope-llm（原 ALIBABA LLM）
 */
import { z } from 'zod'

export const alibabaDashscopeLlmConfigSchema = z.object({
    modelId: z.string().min(1),
    apiKey: z.string().min(1),
    baseURL: z.string().url().optional(),
    extraHeaders: z.record(z.string(), z.string()).optional(),
    capabilities: z.object({ supportsThinking: z.boolean().optional() }).optional(),
})

export type AlibabaDashscopeLlmConfig = z.infer<typeof alibabaDashscopeLlmConfigSchema>
```

`lib/providers/registers/brave-search.ts`:

```typescript
import { z } from 'zod'

export const braveSearchConfigSchema = z.object({
    apiKey: z.string().min(1),
})

export type BraveSearchConfig = z.infer<typeof braveSearchConfigSchema>
```

`lib/providers/registers/volcengine-seedream.ts` — 复用现有 `imageModelCapabilitiesSchema`（从 `@lib/validation/image-model-schema` import），并 **显式** `requestModel`：

```typescript
/**
 * Register：volcengine/seedream — HTTP body 的 `model` 字段来源 `requestModel`（**不是** DB `Model.name`）
 */
import { imageModelCapabilitiesSchema } from '@lib/validation/image-model-schema'
import { z } from 'zod'

export const volcengineSeedreamConfigSchema = z.object({
    requestModel: z.string().min(1),
    apiKey: z.string().min(1),
    baseURL: z.string().url().optional(),
    capabilities: imageModelCapabilitiesSchema,
})

export type VolcengineSeedreamConfig = z.infer<typeof volcengineSeedreamConfigSchema>
```

`lib/providers/registers/dashscope-wan-image.ts`:

```typescript
import { imageModelCapabilitiesSchema } from '@lib/validation/image-model-schema'
import { z } from 'zod'

export const dashscopeWanImageConfigSchema = z.object({
    requestModel: z.string().min(1),
    apiKey: z.string().min(1),
    baseURL: z.string().url().optional(),
    capabilities: imageModelCapabilitiesSchema,
}).superRefine((data, ctx) => {
    if (data.capabilities.maxReferenceImages > 9) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['capabilities', 'maxReferenceImages'],
            message: '万相图像 API 最多 9 张参考图',
        })
    }
})

export type DashscopeWanImageConfig = z.infer<typeof dashscopeWanImageConfigSchema>
```

在 `lib/providers/registry.ts` 追加：

```typescript
import { z } from 'zod'
import { alibabaDashscopeLlmConfigSchema } from '@lib/providers/registers/alibaba-dashscope-llm'
import { braveSearchConfigSchema } from '@lib/providers/registers/brave-search'
import { dashscopeWanImageConfigSchema } from '@lib/providers/registers/dashscope-wan-image'
import { openaiCompatibleGenericConfigSchema } from '@lib/providers/registers/openai-compatible-generic'
import { openaiOfficialConfigSchema } from '@lib/providers/registers/openai-official'
import { volcengineSeedreamConfigSchema } from '@lib/providers/registers/volcengine-seedream'

const SCHEMA_BY_ID: Record<string, z.ZodType<unknown>> = {
    'openai/official': openaiOfficialConfigSchema,
    'openai-compatible/generic': openaiCompatibleGenericConfigSchema,
    'alibaba/dashscope-llm': alibabaDashscopeLlmConfigSchema,
    'brave/search': braveSearchConfigSchema,
    'volcengine/seedream': volcengineSeedreamConfigSchema,
    'dashscope/wan-image': dashscopeWanImageConfigSchema,
}

export function parseModelConfig(registerId: string, raw: unknown): unknown {
    const schema = SCHEMA_BY_ID[registerId]
    if (!schema)
        throw new Error(`unknown registerId: ${registerId}`)
    return schema.parse(raw)
}
```

并确保 **`METADATA` 中每条 `registerId` 均在 `SCHEMA_BY_ID`**。

- [ ] **Step 4: GREEN**

运行: `bun run test -- run tests/providers/registry.test.ts`

预期: **PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/providers/registry.ts lib/providers/registers/*.ts tests/providers/registry.test.ts
git commit -m "feat(providers): add per-register zod schemas and parseModelConfig"
```

---

### Task 3: Prisma — `Model` 目标形状 + 数据迁移 SQL

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260507120000_model_register_json/migration.sql`（时间戳可按实际调整）
- Run: `bun --bun run prisma generate`

- [ ] **Step 1: 替换 `schema.prisma` 中 `Model` 定义**

```prisma
model Model {
  id         String    @id @default(cuid())
  type       ModelType
  /// SPEC：稳定 SKU id，与 lib/providers/registry 一致
  registerId String
  /// 用户可读标签（可能与 API modelId 不同）
  name       String
  /// Register 专属的 JSON，opaque at DB layer
  config     Json
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  selections      ConversationModelSelection[]
  searchBindings  SearchToolBinding[]
  generatedImages Image[]

  @@index([type])
  @@index([registerId])
}

// enum ProviderType { ... }  ← 整块删除（确认无其它模型引用）
```

- [ ] **Step 2: 生成空白迁移并手写 SQL**

执行: `DATABASE_URL="file:./migrate-sandbox.db" bun --bun run prisma migrate dev --create-only --name model_register_json`

然后 **编辑** `migration.sql**（以下为 **示意完整逻辑**；若与 Prisma diff 生成的语句冲突，以「先加列回填再删列」为准）：

```sql
-- 1. 扩容（若 Prisma 已生成创建新表语句，应先备份 PR 中与 FK 对齐的最终脚本）
ALTER TABLE "Model" ADD COLUMN "registerId_new" TEXT;
ALTER TABLE "Model" ADD COLUMN "config_new" JSONB;

-- 2. 按旧 providerType / type 回填（JSON1）
UPDATE "Model" SET "registerId_new" = 'openai/official', "config_new" = json(json_object(
  'modelId', "name",
  'apiKey', "apiKey"
))
WHERE "type" = 'LLM' AND "providerType" = 'OPENAI';

UPDATE "Model" SET "registerId_new" = 'openai-compatible/generic', "config_new" = json(json_object(
  'modelId', "name",
  'baseURL', "baseURL",
  'apiKey', "apiKey",
  'extraHeaders', "extraHeaders"
))
WHERE "type" = 'LLM' AND "providerType" = 'OPENAI_COMPATIBLE';

UPDATE "Model" SET "registerId_new" = 'alibaba/dashscope-llm', "config_new" = json(json_object(
  'modelId', "name",
  'apiKey', "apiKey",
  'baseURL', "baseURL",
  'extraHeaders', "extraHeaders",
  'capabilities', "capabilities"
))
WHERE "type" = 'LLM' AND "providerType" = 'ALIBABA';

UPDATE "Model" SET "registerId_new" = 'brave/search', "config_new" = json(json_object(
  'apiKey', "apiKey"
))
WHERE "type" = 'SEARCH';

UPDATE "Model" SET "registerId_new" = 'volcengine/seedream', "config_new" = json(json_object(
  'requestModel', "name",
  'apiKey', "apiKey",
  'baseURL', "baseURL",
  'capabilities', "capabilities"
))
WHERE "type" = 'IMAGE' AND "providerType" = 'VOLCENGINE_SEEDREAM';

UPDATE "Model" SET "registerId_new" = 'dashscope/wan-image', "config_new" = json(json_object(
  'requestModel', "name",
  'apiKey', "apiKey",
  'baseURL', "baseURL",
  'capabilities', "capabilities"
))
WHERE "type" = 'IMAGE' AND "providerType" = 'DASHSCOPE_WAN_IMAGE';

-- 3. 删除无法满足 NOT NULL 的行（开发库可为 0）；生产若需兜底先人工审计

-- 4. DROP 旧列 + 重命名（SQLite 版本需支持 DROP COLUMN；否则使用「重建表」pragma 流程）
ALTER TABLE "Model" DROP COLUMN "providerType";
-- ... 依次 DROP "baseURL", "apiKey", "contextWindow", "extraHeaders", "capabilities"
ALTER TABLE "Model" DROP COLUMN "baseURL";
ALTER TABLE "Model" DROP COLUMN "apiKey";
ALTER TABLE "Model" DROP COLUMN "contextWindow";
ALTER TABLE "Model" DROP COLUMN "extraHeaders";
ALTER TABLE "Model" DROP COLUMN "capabilities";

ALTER TABLE "Model" RENAME COLUMN "registerId_new" TO "registerId";
ALTER TABLE "Model" RENAME COLUMN "config_new" TO "config";
```

若本地 SQLite **不支持多列 DROP / RENAME**，改用 Prisma 文档中的 **重建表** 范本（将实现者本地 `migrate dev` 报错信息为准，**在同一 migration 文件中完成**）。

- [ ] **Step 3: 应用迁移 + generate**

运行:

```bash
bun --bun run prisma migrate deploy
bun --bun run prisma generate
```

预期: **成功**且无 schema drift。

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): model registerId + config (plan-01 migration)"
```

---

### Task 4: `lib/db/models.ts` 使用 `parseModelConfig`

**Files:**

- Modify: `lib/db/models.ts`
- Modify: `lib/validation/model-input-schema.ts`（若存在统一入口）或新建 `lib/validation/model-upsert-schema.ts`
- Modify: `tests/db/models.test.ts`

- [ ] **Step 1: 新建 Zod：`modelCreateBodySchema`**

`lib/validation/model-upsert-schema.ts`:

```typescript
/**
 * Models API 创建载荷：与 Plan 03 对齐；Plan 01 先用于测试与内部 helper。
 */
import { z } from 'zod'

const base = z.object({
    name: z.string().min(1),
    registerId: z.string().min(1),
    config: z.unknown(),
})

export const modelCreateBodySchema = z.discriminatedUnion('type', [
    base.extend({ type: z.literal('LLM') }),
    base.extend({ type: z.literal('IMAGE') }),
    base.extend({ type: z.literal('SEARCH') }),
])

export type ModelCreateBody = z.infer<typeof modelCreateBodySchema>
```

`registerId` 与 `type` 的一致性 **只在** `@lib/providers/registry` 的 `getRegisterMetadata` 中校验（在 `createModel` 内完成，勿在纯 Zod 文件 import registry 以免造成循环依赖时优先把校验保留在 `models.ts`）。

- [ ] **Step 2: 重写测试 RED**

把 `tests/db/models.test.ts` 中所有 `createLlmModel(prisma, { providerType ...})` **改为**:

```typescript
await createModel(prisma, {
    type: 'LLM',
    registerId: 'openai/official',
    name: '我的 OpenAI',
    config: { modelId: 'gpt-4o', apiKey: 'sk-test' },
})
```

（函数名可按你最终命名统一为 `createModel`。）

运行: `bun run test -- run tests/db/models.test.ts`

预期: **大量 FAIL**

- [ ] **Step 3: 实现 `createModel` / `updateModel`**

`lib/db/models.ts` 核心片段：

```typescript
import { parseModelConfig, getRegisterMetadata } from '@lib/providers/registry'
import { modelCreateBodySchema, type ModelCreateBody } from '@lib/validation/model-upsert-schema'
import type { ModelType, PrismaClient } from '~/generated/prisma/client'
import { Prisma } from '~/generated/prisma/client'

export async function createModel(prisma: PrismaClient, raw: unknown) {
    const body = modelCreateBodySchema.parse(raw) as ModelCreateBody
    const meta = getRegisterMetadata(body.registerId)
    if (!meta || meta.modelType !== body.type)
        throw new Error('registerId 与 type 不匹配')

    const config = parseModelConfig(body.registerId, body.config)
    return prisma.model.create({
        data: {
            type: body.type,
            registerId: body.registerId,
            name: body.name,
            config: config as Prisma.InputJsonValue,
        },
    })
}
```

导出 `createModel` **替代** `createLlmModel` / `createImageModel` / `createSearchModel`（或保留薄包装调用 `createModel`，但 **禁止** 再暴露 providerType）。

- [ ] **Step 4: GREEN**

运行: `bun run test -- run`

预期: **全绿**（含 `migrate deploy` 的测试 DB）

- [ ] **Step 5: Commit**

```bash
git add lib/db/models.ts lib/validation/model-upsert-schema.ts tests/db/models.test.ts app/api/models/route.ts 2>/dev/null; git add ...
git commit -m "feat(db): unify model create/update via registry parse"
```

（若 Task 4 暂不修改 Route，仅 commit models + tests — **但在进入 Plan 03 前须修 Route**。）

---

## Plan 01 — Self-review（对照 SPEC）

| 条款 | 状态 |
| --- | --- |
| G1 静态 Registry | Task 1–2 |
| G3 DB `registerId`+`config` | Task 3 |
| SKU 粒度、Register 互不 import | 文件结构 § |
| §5 索引 | schema `@@index` |
| §10 Registry 测试 | Task 1 |
| 「name 为用户标签」+ 迁移 `modelId/requestModel` | Task 3 回填规则 |

**Placeholder 自查:** 迁移 SQL 若环境 SQLite 能力不足，须在 PR 描述中粘贴 **实测** `sqlite3 --version`，不得留「按需调整」不写对策——实现者应 **选定** rebuild 表或升级工具链并把最终 SQL **写死**在同一 migration。

---

## 执行交接

Plan 完成并保存：`docs/superpowers/plans/2026-05-07-provider-register-plan-01-schema-registry-and-data.md`。下一序列执行 **Plan 02**。

**推荐执行方式:**

1. **Subagent-Driven** — 每 Task 派生子代理 + 阶段 review（**须** `superpowers:subagent-driven-development`）
2. **Inline** — 本会话逐 Task 执行（**须** `superpowers:executing-plans`）

请选择其一。
