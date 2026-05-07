# Provider Register — Plan 04：参考图内核、结构化错误收口、DevTools

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落实 SPEC **G6**（会话内 `imageId` → 校验归属 → bytes/下游形态）、**G5**（统一结构化 tool result、禁止泄露密钥/原始 HTTP）、**G7**（仅开发环境 LLM wrap `devToolsMiddleware`）。

**Architecture:** `lib/providers/_internals/resolve-conversation-image.ts` 提供 `loadConversationImageBuffer(prisma, { conversationId, imageId })`；支持参考图的 Register 扩展 `inputSchema`（数组长度用 Zod）；`executeRegisterImageGeneration` 在调用厂商前载入 buffer。DevTools：**仅** `app/api/chat/route.ts`（或 `lib/providers/runtime/llm.ts` 末尾）且在 `process.env.NODE_ENV === 'development'` 时包装。

**Tech Stack:** Prisma、`ai` `wrapLanguageModel`、`@ai-sdk/devtools`、`vitest`

**前置:** Plan 02–03 完成。

---

## 文件结构

| 路径 | 职责 |
| --- | --- |
| `lib/providers/_internals/resolve-conversation-image.ts` | `server-only`：校验 `Image.conversationId`、读 blob |
| `lib/providers/_internals/redact-tool-error.ts` | 将 `Error` → 公开 `message`，剥离 key-like 子串（保守规则） |
| `lib/tools/web-search.ts` 等 | 异常路径返回 `{ ok:false, code, message }`（对齐 G5） |
| `lib/providers/runtime/image-exec.ts` | Seedream/Wan：**可选** `referenceBuffers` |
| Plan 03 表单 + Zod Register | **扩展** tool `inputSchema`（例如 `referenceImageIds: z.array(z.string()).max(n)`） |
| `app/api/chat/route.ts`（或 `llm.ts`） | Dev wrap |

---

### Task 1: `resolveConversationImage`

**Files:**

- Create: `lib/providers/_internals/resolve-conversation-image.ts`
- Create: `tests/providers/internals/resolve-conversation-image.test.ts`

假定项目已有 **`lib/db/images`** 读取函数；若没有，在本 Task **补充** `getImageBlobById`（仅从现有模式中导入，不要凭空 API）。

```typescript
import 'server-only'
import type { PrismaClient } from '~/generated/prisma/client'

export class ConversationImageForbiddenError extends Error {
    constructor() {
        super('IMAGE_NOT_IN_CONVERSATION')
    }
}

export async function loadConversationImageBuffer(
    prisma: PrismaClient,
    params: { conversationId: string, imageId: string },
): Promise<{ buffer: Buffer, mimeType: string }> {
    const row = await prisma.image.findUnique({ where: { id: params.imageId } })
    if (!row || row.conversationId !== params.conversationId)
        throw new ConversationImageForbiddenError()

    // 接续：从你项目存储策略读取 bytes（若在 DB 仅存路径则用 fs；实现者按仓库真实代码填写）
    throw new Error('implement: wire to actual blob reader')
}
```

- [ ] **Step 1: 写测试** mock Prisma：`findUnique` 返回不匹配 → `ConversationImageForbiddenError`。

- [ ] **Step 2: 实现直至 GREEN**, commit "`feat(kernel): scoped conversation image load`"

---

### Task 2: Register 扩展参考图输入

**Files:**

- Modify: `lib/providers/registers/volcengine-seedream.ts`（按需 Zod：**可选** `referenceImageIds`）
- Modify: `lib/tools/image-generate.ts`：**若** parsed 内含 ids → 并行 `Promise.all(ids.map(...load...))`

Tool `inputSchema` 示例片段：

```typescript
inputSchema: z.object({
    prompt: z.string().min(1).max(2000),
    referenceImageIds: z.array(z.string().min(1)).max(capMax).optional(),
})
```

`capMax` 从 `parsed.capabilities.maxReferenceImages` 读取。**当 `referenceImageIds` 缺省时**保持与现网一致。

厂商 HTTP **若暂未接参考 Multipart**：仍落地 schema + loader +「未实现」结构化返回 `{ ok:false, code:'REF_NOT_SUPPORTED_FOR_VENDOR', message:'...' }`，并在 SPEC 留白处写明「后续 SKU 逐项接 API」——**此处不得空白**，必须选一个明确行为。**推荐**：对已支持参考的 SKU 接入真实调用；不支持则 schema **不含** optional 字段（由 Register metadata 标示 `supportsReference: boolean`）。

- [ ] **Step 3: Commit** "`feat(image): optional reference ids through register schema`"

---

### Task 3: 结构化错误与脱敏收口

**Files:**

- Create: `lib/providers/_internals/redact-tool-error.ts`

```typescript
const keyLikePatterns = [/sk-[a-zA-Z0-9]{10,}/, /Bearer\s+[a-zA-Z0-9._-]{10,}/]

export function toPublicToolErrorMessage(raw: string): string {
    let m = raw
    for (const re of keyLikePatterns)
        m = m.replace(re, '[redacted]')
    if (m.length > 600)
        m = `${m.slice(0, 600)}…`
    return m
}
```

- [ ] **统一** Search / Fetch / Rename 工具的 `catch`（范围以 `grep "createXxxTool"` 为准），返回 `{ ok:false, code, message }`。

- [ ] **测试：** `tests/providers/internals/redact-tool-error.test.ts`：`sk-xxxx` → `[redacted]`

- [ ] **Commit** "`feat(tools): structured failures + redacted messages (G5)`"

---

### Task 4: DevTools（仅开发）

以本地安装包 README 为准（已交叉验证）：`wrapLanguageModel` + `devToolsMiddleware()`。

修改 `lib/providers/runtime/llm.ts` **末尾导出**：

```typescript
import { wrapLanguageModel } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'

export function wrapLlmForDevIfNeeded(lm: LanguageModel): LanguageModel {
    if (process.env.NODE_ENV !== 'development')
        return lm
    return wrapLanguageModel({
        model: lm,
        middleware: devToolsMiddleware(),
    })
}
```

`app/api/chat/route.ts`：**仅一行**改动 `buildLlmLanguageModel(...) → wrapLlmForDevIfNeeded(buildLlmLanguageModel(...))`（respect `deps.model` 注入）。

- [ ] **测试：** `tests/providers/runtime/llm.test.ts` 中断言 **生产**模式下 `NODE_ENV='test'` **不** import devtools副作用（可采用 `vi.resetModules()` 或把 wrap 抽到纯函数便于 spy）。

README 写明：`NODE_ENV=development bun dev` + 另开终端 `npx @ai-sdk/devtools`。

- [ ] **Commit** "`chore(ai): optional devtools middleware for LLM (G7)`"

---

### Task 5: 端到端核对

- [ ] `bun run lint`、`bun run test -- run`
- [ ] （可选）`ce-test-browser` 技能：手动点设置页添加每条 Register

---

## Plan 04 — Self-review（对照 SPEC）

| 条款 | Task |
| --- | --- |
| G6 | 1–2 |
| G5 | 3 |
| G7 | 4 |
| §8 | Task 4 与 README |

---

## 执行交接

四份计划收尾后回到 [总览](./2026-05-07-provider-register-plans-overview.md) 做 release note；考虑更新 `canvases/Provider工厂.canvas.tsx`。

**推荐执行方式:** Subagent-Driven 或 Inline（同上）。
