# Provider Register — Plan 02：运行时分发（LLM / 生图 / Search 工具）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 已存于 DB 的 `Model` 行在 **Chat 与工具注册** 路径上 **仅通过 `registerId` + `config`** 构建 AI SDK `LanguageModel`、生图执行与 Search 工具；删除对 `ProviderType` 列的依赖；为 **G5** 引入 **最小** 结构化失败返回（非抛错）。

**Architecture:** `lib/providers/runtime/*`（`server-only`）承载「Record → SDK」映射；Register 层的 Zod 类型用 `parseModelConfig` 再收窄；`lib/llm-provider-factory.ts` 变为薄委托或删除并由 `runtime/llm.ts` **替代**。`computeLlmChatProviderOptions` 改为读取 **`config`** 与 `capabilities`（不再触 `providerType`）。

**Tech Stack:** `ai` v6、`@ai-sdk/openai`、`@ai-sdk/alibaba`、`vitest`、`server-only`

**前置:** 已完成 [Plan 01](./2026-05-07-provider-register-plan-01-schema-registry-and-data.md)。

---

## 文件结构

| 路径 | 职责 |
| --- | --- |
| `lib/providers/runtime/llm.ts` | `buildLlmLanguageModel(model: Model): LanguageModel` |
| `lib/providers/runtime/search.ts` | `getBraveApiKey(model: Model): string`（或返回 tool 实例） |
| `lib/providers/runtime/image-exec.ts` | `executeRegisterImageGeneration({ model, parsedConfig, prompt, size, conversationId, prisma, abortSignal })` |
| `lib/tools/tool-registry.ts` | 读取 `parsedConfig`/capabilities（或内联解析）挂载 `image-generate-*` |
| `lib/tools/image-generate.ts` | 调用 `executeRegisterImageGeneration`；**try/catch** → 结构化结果 |
| `app/api/chat/route.ts` | `buildLlmLanguageModel` 替换 `buildLlmModel` |
| `lib/llm-chat-provider-options.ts` | 基于 `registerId === 'alibaba/dashscope-llm'` + `config.capabilities` + `selection.params` |
| `tests/lib/llm-provider-factory.test.ts` | 迁移为 `runtime/llm` 测试或重命名 |
| `tests/image-provider-factory.test.ts` | 改为走新 runtime（mock `fetch` 保持） |

---

### Task 1: `buildLlmLanguageModel` + 单测迁移

**Files:**

- Create: `lib/providers/runtime/llm.ts`（首行 `'use strict'` 非必须；**首行请加** `import 'server-only'`）
- Modify: `app/api/chat/route.ts`（import 路径）
- Delete 或变薄: `lib/llm-provider-factory.ts`
- Rename/Move tests → `tests/providers/runtime/llm.test.ts`

- [ ] **Step 1: 失败测试**（从新文件开始）

`tests/providers/runtime/llm.test.ts`:

```typescript
import type { Model } from '~/generated/prisma/client'
import { buildLlmLanguageModel } from '@lib/providers/runtime/llm'
import { describe, expect, it } from 'vitest'

const base = { id: 'm1', createdAt: new Date(), updatedAt: new Date(), name: '展示名', type: 'LLM' as const, config: {} }

describe('buildLlmLanguageModel', () => {
    it('openai/official uses config.modelId for provider model string', async () => {
        const record = {
            ...base,
            registerId: 'openai/official',
            config: { modelId: 'gpt-4o-mini', apiKey: 'sk-test' },
        } satisfies Model
        const lm = buildLlmLanguageModel(record)
        expect(lm).toBeDefined()
    })

    it('throws on unknown register', () => {
        const record = { ...base, registerId: 'nope/x', config: {} } as Model
        expect(() => buildLlmLanguageModel(record)).toThrow()
    })
})
```

- [ ] **Step 2: RED** — `bun run test -- run tests/providers/runtime/llm.test.ts`

- [ ] **Step 3: 实现**

`lib/providers/runtime/llm.ts`:

```typescript
/**
 * DB Model 行 → AI SDK LanguageModel（Register 运行时）
 */
import type { LanguageModel } from 'ai'
import type { Model } from '~/generated/prisma/client'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAlibaba } from '@ai-sdk/alibaba'
import { parseModelConfig } from '@lib/providers/registry'
import 'server-only'

export function buildLlmLanguageModel(model: Model): LanguageModel {
    if (model.type !== 'LLM')
        throw new Error('not an LLM model')

    switch (model.registerId) {
        case 'openai/official': {
            const c = parseModelConfig(model.registerId, model.config) as { modelId: string, apiKey: string }
            const p = createOpenAI({ apiKey: c.apiKey })
            return p(c.modelId)
        }
        case 'openai-compatible/generic': {
            const c = parseModelConfig(model.registerId, model.config) as {
                modelId: string
                baseURL: string
                apiKey: string
                extraHeaders?: Record<string, string>
            }
            const prov = createOpenAICompatible({
                name: model.name,
                baseURL: c.baseURL,
                apiKey: c.apiKey,
                headers: c.extraHeaders,
            })
            return prov(c.modelId)
        }
        case 'alibaba/dashscope-llm': {
            const c = parseModelConfig(model.registerId, model.config) as {
                modelId: string
                apiKey: string
                baseURL?: string
                extraHeaders?: Record<string, string>
            }
            const prov = createAlibaba({
                apiKey: c.apiKey,
                baseURL: c.baseURL,
                headers: c.extraHeaders,
            })
            return prov(c.modelId)
        }
        default:
            throw new Error(`unsupported LLM register: ${model.registerId}`)
    }
}
```

- [ ] **Step 4: 更新 Chat 路由**

`app/api/chat/route.ts` 将 `import { buildLlmModel } from '@lib/llm-provider-factory'` **改为** `@lib/providers/runtime/llm` 的 `buildLlmLanguageModel`，并把 `deps.model ?? buildLlmModel(modelRecord)` **改为** `deps.model ?? buildLlmLanguageModel(modelRecord)`。

- [ ] **Step 5: GREEN** — `bun run test -- run`

- [ ] **Step 6: Commit**

```bash
git add lib/providers/runtime/llm.ts app/api/chat/route.ts tests/providers/runtime/llm.test.ts
git commit -m "feat(runtime): build LLM from registerId + config"
```

---

### Task 2: `computeLlmChatProviderOptions` 去 `providerType`

**Files:**

- Modify: `lib/llm-chat-provider-options.ts`
- Modify: `tests/` 中与 thinking 相关的用例（若存在）；否则新建 `tests/lib/llm-chat-provider-options.test.ts`

- [ ] **Step 1: 测试先行**

```typescript
import type { Model } from '~/generated/prisma/client'
import { computeLlmChatProviderOptions } from '@lib/llm-chat-provider-options'
import { describe, expect, it } from 'vitest'

describe('computeLlmChatProviderOptions', () => {
    it('enables thinking only for alibaba register with capability + selection', () => {
        const model = {
            id: 'x',
            type: 'LLM',
            registerId: 'alibaba/dashscope-llm',
            name: 'n',
            config: {
                modelId: 'qwen-plus',
                apiKey: 'k',
                capabilities: { supportsThinking: true },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        } satisfies Model
        expect(computeLlmChatProviderOptions(model, { thinkingEnabled: true })).toEqual({
            alibaba: { enableThinking: true },
        })
    })

    it('returns undefined when register is not alibaba', () => {
        const model = {
            id: 'x',
            type: 'LLM',
            registerId: 'openai/official',
            name: 'n',
            config: { modelId: 'gpt-4o', apiKey: 'k' },
            createdAt: new Date(),
            updatedAt: new Date(),
        } satisfies Model
        expect(computeLlmChatProviderOptions(model, { thinkingEnabled: true })).toBeUndefined()
    })
})
```

- [ ] **Step 2: 实现替换**

```typescript
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { Model } from '~/generated/prisma/client'

function llmSupportsThinkingFromConfig(config: unknown): boolean {
    if (!config || typeof config !== 'object')
        return false
    const cap = (config as { capabilities?: { supportsThinking?: boolean } }).capabilities
    return cap?.supportsThinking === true
}

export function computeLlmChatProviderOptions(
    model: Model,
    params: unknown,
): ProviderOptions | undefined {
    if (model.registerId !== 'alibaba/dashscope-llm')
        return undefined

    const p = params as { thinkingEnabled?: boolean } | null | undefined
    if (!llmSupportsThinkingFromConfig(model.config) || !p?.thinkingEnabled)
        return undefined

    return {
        alibaba: {
            enableThinking: true,
        },
    }
}
```

- [ ] **Step 3: `bun run test -- run`**, commit "`refactor(llm): provider options keyed by registerId`"

---

### Task 3: 生图执行迁移 + 结构化失败

**Files:**

- Create: `lib/providers/runtime/image-exec.ts`
- Modify: `lib/image-provider-factory.ts`（整体删除或 **仅 re-export** `executeRegisterImageGeneration` 做兼容）
- Modify: `lib/tools/image-generate.ts`
- Modify: `tests/image-provider-factory.test.ts`

- [ ] **Step 1: 把现有 `executeSeedream` / `executeDashscopeWanImage` 挪入 `image-exec.ts`，入参改用 `parsed` config**

骨架：

```typescript
import 'server-only'
import type { PrismaClient } from '~/generated/prisma/client'
import type { VolcengineSeedreamConfig } from '@lib/providers/registers/volcengine-seedream'
import type { DashscopeWanImageConfig } from '@lib/providers/registers/dashscope-wan-image'
import { parseModelConfig } from '@lib/providers/registry'

export interface ImageGenContext {
    model: { id: string, registerId: string, config: unknown }
    prompt: string
    size: string
    conversationId: string
    prisma: PrismaClient
    abortSignal?: AbortSignal
}

export async function executeRegisterImageGeneration(ctx: ImageGenContext) {
    switch (ctx.model.registerId) {
        case 'volcengine/seedream': {
            const c = parseModelConfig(ctx.model.registerId, ctx.model.config) as VolcengineSeedreamConfig
            return runSeedream(ctx, c)
        }
        case 'dashscope/wan-image': {
            const c = parseModelConfig(ctx.model.registerId, ctx.model.config) as DashscopeWanImageConfig
            return runWan(ctx, c)
        }
        default:
            throw new Error(`unsupported image register: ${ctx.model.registerId}`)
    }
}
```

复制 **Plan 01 之前** `lib/image-provider-factory.ts` 中 HTTP 逻辑，但把 **`model.name`** 改为 **`c.requestModel`**（Seedream POST `model`）；Wan 亦同。

- [ ] **Step 2: `createImageGenerateTool` 包裹结构化错误**

```typescript
execute: async (input, { abortSignal }) => {
    try {
        return await executeRegisterImageGeneration({ ... })
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return {
            ok: false as const,
            code: 'IMAGE_GEN_FAILED',
            message: message.slice(0, 500),
        }
    }
},
```

成功路径仍返回现有形状 `{ imageId, mimeType, sizeBytes }` 并 **加** `ok: true as const`（可选；若 UI 依赖旧形状，则成功不加 `ok`，仅错误返回结构化 —— **实现者须在 `tests/tools/image-generate.test.ts` 中断言**）。

- [ ] **Step 3: 跑 `bun run test -- run tests/image-provider-factory.test.ts tests/tools/image-generate.test.ts`**

- [ ] **Step 4: Commit** "`feat(runtime): image generation by register + structured tool errors`"

---

### Task 4: `tool-registry` 与 Search 绑定

**Files:**

- Modify: `lib/tools/tool-registry.ts`
- Modify: `lib/tools/web-search.ts` / `image-search.ts`（若需从 `Model` 取 key）

- [ ] **Step 1: 对 Search 模型 `parseModelConfig('brave/search', model.config)` 取 `apiKey`**

- [ ] **Step 2: 生图工具构建时从 `model.config` 读取 `capabilities.supportedSizes`（不再读已删除的顶层 `capabilities` 列）**

片段：

```typescript
import { parseModelConfig } from '@lib/providers/registry'
import type { VolcengineSeedreamConfig } from '@lib/providers/registers/volcengine-seedream'

// inside primary branch
const parsed = parseModelConfig(model.registerId, model.config) as VolcengineSeedreamConfig | DashscopeWanImageConfig
const defaultSize = parsed.capabilities.supportedSizes[0] ?? '1024x1024'
```

对 `registerId` 分支使用 **联合类型** 或 `switch`。

- [ ] **Step 3: 全量 `bun run test -- run`**, commit "`refactor(tools): tool-registry uses register config`"

---

## Plan 02 — Self-review（对照 SPEC）

| 条款 | 任务 |
| --- | --- |
| G4 LLM / IMAGE / SEARCH 运行时 | Task 1–4 |
| §7 Agent 运行时 | Chat + tool-registry |
| G5 结构化 tool 结果（起步） | Task 3 |
| G7 DevTools | **不在本计划**（Plan 04） |

---

## 执行交接

下一序列：[Plan 03 — 设置页与 API](./2026-05-07-provider-register-plan-03-settings-api-ui.md)。

**推荐执行方式:** Subagent-Driven（`superpowers:subagent-driven-development`）或 Inline（`superpowers:executing-plans`）。
