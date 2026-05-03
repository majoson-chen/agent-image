# Composer 用户图片上传恢复 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Composer 中恢复「用户选图 → 服务端落库 `Image`（`USER_UPLOAD`）→ 以 AI SDK 原生 `text` + `file` parts 发送 user 消息」；附件在独立 UI 区展示；持久化以 `/api/images/{id}` 引用为主；结构化说明独立根元素 `agent-image-user-attach`，与 `image-fetch` 工具链无运行时耦合。

**Architecture:** 前端用 `multipart/form-data` 调用新建 `POST /api/images`，校验 MIME（`detectMime` / `isAllowedMime`）、体积（与 `image-fetch` 对齐 10MB）、单会话待发送上限 10 张。组装 `parts`：首段为 `buildUserAttachXml` 文本，可选第二段为用户可见正文，随后按 slot 顺序排列 `type:'file', mediaType, url:'/api/images/{id}'`。服务端 `handleChatPost` 在交给 `createAgentUIStreamResponse` 前，对 user 消息中含相对路径的 file part 做**必要时**的解析（读盘填 `data` 或经绝对 URL 拉取）——以集成验证为准，避免模型请求阶段相对 URL 无法解析。`ChatPage` 渲染 user 消息时隐藏/弱化 XML 段，仅展示用户正文与缩略图。

**Tech Stack:** Next.js App Router、`ai` 6.x（`UIMessage`、`FileUIPart`、`createAgentUIStreamResponse`）、Prisma、`createImage`、`vitest`。

**权威规格:** `docs/superpowers/specs/2026-05-03-feat-composer-user-image-upload-design.md`
**模式沉淀:** `docs/solutions/design-patterns/composer-user-image-upload-multimodal-2026-05-03.md`

---

## 文件与职责（落地前总览）

| 路径                                                               | 动作   | 职责                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/image-upload-limits.ts`（或 `lib/constants/image-limits.ts`） | 新建   | 导出 **`USER_ATTACH_MAX_IMAGES = 10`**（与 `IMAGE_FETCH_MAX_SOURCES` 数值对齐）；**禁止**在客户端从 `lib/tools/image-fetch.ts` 导入该常量（该文件含 `server-only`）。`image-fetch` 与 Composer 附件逻辑可改为从此共享模块引用。 |
| `lib/ai/user-attach-xml.ts`                                        | 新建   | 常量 `USER_ATTACH_XML_TAG`（`agent-image-user-attach`）、`buildUserAttachXml`、`isUserAttachInjectText`（供 UI 与测试）                                                                                                         |
| `app/api/images/route.ts`                                          | 新建   | `POST`：`FormData`（`conversationId`、`file`）→ 校验 → `createImage(USER_UPLOAD)` → JSON `{ id, mimeType, sizeBytes }`                                                                                                          |
| `app/api/images/[id]/route.ts`                                     | 保持   | 已有 `GET` 读图不变                                                                                                                                                                                                             |
| `lib/tools/image-fetch.ts`                                         | 修改   | `IMAGE_FETCH_MAX_SOURCES` 改为从 `lib/image-upload-limits.ts` 导入，避免与附件上限分叉                                                                                                                                          |
| `lib/chat-guard.ts`                                                | 修改   | `getSubmitButtonState` 增加「有附件时允许 input 为空仍可发送」                                                                                                                                                                  |
| `tests/lib/chat-guard.test.ts`                                     | 修改   | 覆盖「仅附件可发」                                                                                                                                                                                                              |
| `app/conversations/[id]/ComposerAttachments.tsx`（或同级组件名）   | 新建   | 独立附件带：文件按钮、chip 列表、删除、可选拖放                                                                                                                                                                                 |
| `app/conversations/[id]/ChatPage.tsx`                              | 修改   | 接入附件状态、`sendMessage` 组装 `parts`、user 气泡渲染（XML 段不展示给用户、file 支持 `/api/images/` URL）                                                                                                                     |
| `app/api/chat/route.ts`（`handleChatPost`）                        | 修改   | 在 `createAgentUIStreamResponse` 之前对 `uiMessages` 做 user file part 规范化（见 Task 5）                                                                                                                                      |
| `lib/ai/prompts/system.mustache.txt`                               | 修改   | 简短说明 `agent-image-user-attach` 与 file part 顺序对齐                                                                                                                                                                        |
| `lib/ai/system-prompt.ts`                                          | 视需要 | 若 Mustache 需新变量则扩展 `buildSystemPrompt`                                                                                                                                                                                  |
| `tests/api/images/post.test.ts`                                    | 新建   | POST 成功/校验失败/会话不存在                                                                                                                                                                                                   |
| `tests/ai/user-attach-xml.test.ts`                                 | 新建   | XML 与 slot 序号                                                                                                                                                                                                                |
| `tests/conversations/ChatPage.test.tsx`                            | 修改   | mock `fetch` POST 与 `sendMessage` 的 `parts` 形状（可选与 `tests/api/chat` 集成二选一）                                                                                                                                        |
| `tests/api/chat/route.test.ts` 或新建集成测                        | 视需要 | 含 file part 的 user 消息能完成一轮（验证规范化路径）                                                                                                                                                                           |
| `canvases/*.canvas.tsx`                                            | 修改   | 按规格 **Canvas 同步** 表（合并前）                                                                                                                                                                                             |

---

### Task 1: 用户附件 XML 纯函数 + 测试

**Files:**

- Create: `lib/ai/user-attach-xml.ts`
- Test: `tests/ai/user-attach-xml.test.ts`

- [ ] **Step 1: 写失败测试（slot 序号与属性转义）**

```typescript
import { buildUserAttachXml, isUserAttachInjectText, USER_ATTACH_XML_TAG } from '@lib/ai/user-attach-xml'
import { describe, expect, it } from 'vitest'

describe('user-attach-xml', () => {
    it('builds xml with sequential slots', () => {
        const xml = buildUserAttachXml([
            { imageId: 'a', mimeType: 'image/png' },
            { imageId: 'b', mimeType: 'image/jpeg' },
        ])
        expect(xml).toContain(`<${USER_ATTACH_XML_TAG}`)
        expect(xml).toMatch(/n="1".*imageId="a"/s)
        expect(xml).toMatch(/n="2".*imageId="b"/s)
    })

    it('detects inject block', () => {
        expect(isUserAttachInjectText(`  <${USER_ATTACH_XML_TAG} version="1">`)).toBe(true)
        expect(isUserAttachInjectText('hello')).toBe(false)
    })
})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `bun test tests/ai/user-attach-xml.test.ts`
Expected: FAIL（模块不存在或未导出）

- [ ] **Step 3: 最小实现**

实现要点：`escapeXmlAttr` / `escapeXmlText` 可与 `vision-inject-xml.ts` 同样复制或抽私有小函数（YAGNI：首版允许轻微重复，避免过度抽象）。XML 内包含简短 `<instructions>`：明示后续 file part 与 slot 顺序一致。

- [ ] **Step 4: 运行测试 GREEN**

Run: `bun test tests/ai/user-attach-xml.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ai/user-attach-xml.ts tests/ai/user-attach-xml.test.ts
git commit -m "feat(ai): user attach XML builder for composer uploads"
```

---

### Task 2: POST /api/images（落库 USER_UPLOAD）

**Files:**

- Create: `app/api/images/route.ts`（导出 `handlePostImage` 便于测试，与 `handleGetImage` 模式一致）
- Test: `tests/api/images/post.test.ts`

约束对齐：`lib/tools/image-fetch.ts` 的 `MAX_SIZE_BYTES = 10 * 1024 * 1024`；MIME 白名单 `lib/images/mime.ts`。校验 `conversationId` 在 DB 存在（`prisma.conversation.findUnique`）。

- [ ] **Step 1: 写失败测试（超限大小、非法 MIME、缺 conversation）**

```typescript
import type { PrismaClient } from '~/generated/prisma/client'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createConversation } from '@lib/db/conversations'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { handlePostImage } from '@/api/images/route'
import { createTestDb } from '../../helpers/db'

// beforeAll createTestDb; beforeEach DATA_IMAGES_ROOT tmp; 构造 FormData + Request
// it: returns 413 or 400 when file > 10MB; returns 400 when buffer 非图片 magic; returns 404 when conversationId 无效
```

- [ ] **Step 2: RED** — `bun test tests/api/images/post.test.ts`

- [ ] **Step 3: 实现 `handlePostImage`** — `request.formData()` → `file` as File → `arrayBuffer` → `Buffer` → `detectMime` → `isAllowedMime` → `createImage(..., source: 'USER_UPLOAD')` → `NextResponse.json({ id, mimeType, sizeBytes })`

- [ ] **Step 4: GREEN** — `bun test tests/api/images/post.test.ts`

- [ ] **Step 5: Commit** — `feat(api): POST /api/images for user upload`

---

### Task 3: 发送门闸 — 有附件时允许空文案

**Files:**

- Modify: `lib/chat-guard.ts`
- Modify: `tests/lib/chat-guard.test.ts`
- Modify: `app/conversations/[id]/ChatPage.tsx`（调用处传入 `hasAttachments`）

- [ ] **Step 1: 写失败测试**

```typescript
it('send enabled when input empty but has attachments', () => {
    const state = getSubmitButtonState({
        status: 'ready',
        llmSelected: true,
        inputEmpty: true,
        hasAttachments: true,
    })
    expect(state.kind).toBe('send')
    if (state.kind === 'send')
        expect(state.disabled).toBe(false)
})
```

- [ ] **Step 2: RED** — `bun test tests/lib/chat-guard.test.ts`

- [ ] **Step 3: 修改 `getSubmitButtonState`**：`inputEffectivelyEmpty = inputEmpty && !hasAttachments`；`disabled = !llmSelected || inputEffectivelyEmpty`（streaming 语义不变）

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit** — `fix(chat-guard): allow send with attachments only`

---

### Task 4: Composer UI — 独立附件区 + sendMessage parts

**Files:**

- Create: `app/conversations/[id]/ComposerAttachments.tsx`（或同级）
- Modify: `app/conversations/[id]/ChatPage.tsx`
- Modify: `tests/conversations/ChatPage.test.tsx`（如已有 mock，可断言 `sendMessage` 收到 `parts`）

实现要点：

1. 状态：`Array<{ id: string, mimeType: string }>`，最多 **`USER_ATTACH_MAX_IMAGES`**（从 **`lib/image-upload-limits.ts`** 导入；勿从 `@lib/tools/image-fetch` 导入——该模块为 `server-only`，客户端会构建失败）。
2. `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" multiple />` + 选文件后逐个 `fetch('/api/images', { method:'POST', body: formData })`；失败 `alert` 或 daisyUI `toast`（与现有错误展示一致）。
3. 布局：放在「LLM / 生图槽」与 `<form>` 输入行**之间**（见规格）。
4. `handleSubmit`：`parts = []`；若有附件：`parts.push({ type:'text', text: buildUserAttachXml([...]) })`；若 `input.trim()` 非空：`parts.push({ type:'text', text: input.trim() })`；对每个附件 `parts.push({ type:'file', mediaType, url: \`/api/images/${id}\` })`。
5. 发送后清空附件 state。
6. User 气泡：`parts` 遍历时若 `type==='text' && isUserAttachInjectText(p.text)` → `return null` 或极短辅助文案；`type==='file' && url.startsWith('/api/images/')` → `<img src={url} ... />`；保留 `data:image/` 分支以兼容历史 `image-fetch` 持久化消息。

- [ ] **Step 1: ChatPage 测试 RED**（可选但推荐）：mock `global.fetch`，断言 `sendMessage` 的 parts 数量与顺序。

- [ ] **Step 2: 实现组件与 ChatPage 改动**

- [ ] **Step 3: GREEN** — `bun test tests/conversations/ChatPage.test.ts`（及全量 `bun test` 若时间允许）

- [ ] **Step 4: Commit** — `feat(chat): composer UI and multimodal send for user uploads`

---

### Task 5: Chat 路由 — user file part 服务端可解析（模型输入）

**Files:**

- Modify: `app/api/chat/route.ts`
- 可选新建: `lib/ai/normalize-user-image-parts.ts`（保持 route 薄）

在 `createAgentUIStreamResponse({ agent, uiMessages, ... })` 之前：

1. 深拷贝或 map `uiMessages`，只对 `role === 'user'` 处理。
2. 对每个 `type === 'file'` 且 `url` 为 `/api/images/{uuid}`（严格匹配本应用前缀）的 part：用 `getImage` 校验 `conversationId`，`readImageBuffer` 读字节；将传入模型的那份 message 的 part 改为与 `buildVisionUserUiParts` 类似：`url` 设为 `data:${mime};base64,...` **或** `FilePart` 接受的 `data: Buffer`（按 `convertToModelMessages` 下游实现选择：当前 bundle 将 `part.url` 转 `data: part.url`，若 URL 相对串在 provider 不可下则必须用 base64/Buffer）。
3. **不要**改写入 DB 的 client 同步逻辑：`syncIncomingClientUserMessages` 仍应保存客户端发来的 `/api/images/` 引用（若当前实现是先 sync 再跑 agent，确认顺序：若 client 已写入 DB，`upsertUserMessageParts` 存的是原始 parts；规范化仅作用于传给 `createAgentUIStreamResponse` 的内存副本）。

请先阅读 `handleChatPost` 内 `clientMessagesOpt` 与 `uiMessages` 赋值顺序，确保规范化数组是**传给 agent 的那份**，而 DB 中 JSON 仍为轻量 URL。

- [ ] **Step 1: 写集成/单元测试**
      在 `tests/api/chat/route.test.ts`（或新建）构造带 `file` part（相对 `/api/images/id`）的 POST body，mock `buildAgent` / 或使用项目已有 chat 测试夹具断言「未抛错且模型收到多模态」（若现有夹具过简，可只断言规范化函数将 1 个 file part 展开为 data URL）。

- [ ] **Step 2: 实现规范化**

- [ ] **Step 3: `bun test` GREEN**

- [ ] **Step 4: Commit** — `fix(chat): resolve user upload image URLs for model messages`

---

### Task 6: System prompt 提示

**Files:**

- Modify: `lib/ai/prompts/system.mustache.txt`
- 视需要: `lib/ai/system-prompt.ts`

增加 2～4 行：当 user 消息的 **text part** 中含 `<agent-image-user-attach>` 块时，紧随其后的 **file part** 与 slot 顺序一致；勿与 `image-fetch` 工具混淆。不写冗长示例 XML。

- [ ] **实现 + 手动读一遍与 R3/R9 无冲突**

- [ ] **Commit** — `docs(prompt): mention user attach vision block`

---

### Task 7: Canvas 与全量验证

**Files:**

- Modify: 规格中列出的 `canvases/*.canvas.tsx`

- [ ] 按 `docs/superpowers/specs/2026-05-03-feat-composer-user-image-upload-design.md` 的 **Canvas 同步** 表更新画布。

- [ ] Run: `bun test`
- [ ] Run: `bun run lint`（或项目等价命令）修复全部 warning/error。

- [ ] **Commit** — `docs(canvas): sync composer user upload flow`

---

## Self-review（计划自检）

| 规格条目                                | 对应 Task    |
| --------------------------------------- | ------------ |
| 上传落库 `USER_UPLOAD` + `imageId`      | Task 2       |
| AI SDK 原生 parts、无 image-fetch 耦合  | Task 4、5    |
| 结构化说明 + slot 顺序                  | Task 1、4    |
| 独立附件 UI、与 ComposerImageSlot 区分  | Task 4       |
| 10 张上限、纯图可发、`/api/images` 引用 | Task 2、3、4 |
| 独立根 `agent-image-user-attach`        | Task 1       |
| 测试与 TDD                              | 各 Task      |
| System prompt                           | Task 6       |
| Canvas                                  | Task 7       |

**Placeholder scan:** 无 TBD。

**类型一致性：** `FileUIPart` 使用 `mediaType` + `url`（与 AI SDK 一致）；勿拼错为 `mimeType`。

---

## 执行交接

**Plan complete and saved to** `docs/superpowers/plans/2026-05-03-feat-composer-user-image-upload-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 每 Task 派生子代理，Task 间人工快速过目；**REQUIRED SUB-SKILL:** superpowers:subagent-driven-development

2. **Inline Execution** — 本会话按 Task 顺序执行；**REQUIRED SUB-SKILL:** superpowers:executing-plans

**Which approach?**

（若无需子代理回复：任选其一并在下一轮声明即可。）

---

## 备注（调研结论摘要）

- `convertToModelMessages` 将 `FileUIPart.url` 写入模型侧 `FilePart.data`（字符串 URL 或 data URL）；**相对路径**在服务端调模型时能否被 provider 下载需实测，故 Task 5 以「读盘转 data URL/Buffer」为保险实现路径。
- DB 侧 `upsertUserMessageParts` 已支持任意 `parts` JSON；`extractTextContent` 仍会拼接所有 text part（含 XML），与既有 **image-fetch** 合成 user 消息行为一致；用户可见性由 **Task 4** 渲染过滤保证。

本轮未再单独派出 `research-assistant`：上下文已通过规格、`node_modules/ai/dist/index.d.ts`（`UIMessage` / `FileUIPart`）与 `index.mjs` 内 `convertToModelMessages` 片段核对完毕。
