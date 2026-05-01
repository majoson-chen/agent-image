---
title: "fix: Image UIMessage format + ToolLoop multimodal injection"
type: fix
status: active
date: 2026-04-30
---

# fix: Image UIMessage format + ToolLoop multimodal injection

## Overview

修复两个相关问题：

1. **500 错误**：`hydrateImagesForLLM` 把图像转换成 `{ type: 'image', image: Buffer }` 格式，但 AI SDK v5 `createAgentUIStreamResponse` 内部的 `validateUIMessages` 只接受合法的 UIMessage part 类型（`text`、`file`、`data-*` 等），`image` 不在其中，导致每次有图片上传的对话均以 500 崩溃。
2. **ToolLoop 视觉感知缺失**：`image-generate` / `image-fetch` 工具的 `execute` 仅返回 `{ imageId, mimeType, sizeBytes }` JSON，LLM 在 ToolLoop 内部无法真正"看到"图像；需通过 `toModelOutput` 将图像字节随工具结果一并注入。

---

## Problem Frame

- 用户上传图片后发起对话，服务端 `hydrateImagesForLLM` 将 `image-ref` part 转为 `{ type: 'image', image: Buffer }` 并传入 `createAgentUIStreamResponse({ uiMessages })` → AI SDK 内部 `validateUIMessages` 用 Zod 校验 UIMessage，找不到 `image` 类型 → `ZodError: "Invalid string: must start with 'data-'"` → 500。
- AI SDK v5 的正确图像 UIMessage part 类型是 `file`：`{ type: 'file', mediaType, url: 'data:...;base64,...' }`；`convertToModelMessages` 将其转为 `FilePart` 模型消息供 LLM 使用。
- 工具定义支持 `toModelOutput?: (options) => ToolResultOutput | Promise<ToolResultOutput>`；返回 `{ type: 'content', value: [{ type: 'image-data', data: base64, mediaType }] }` 时，AI SDK 会在 ToolLoop 的下一步 LLM call 中将图像字节注入 tool-result 消息，使 LLM 能立即看到生成/抓取的图像。

---

## Requirements Trace

- R1. 修复图片上传导致的 500 错误，恢复正常对话。
- R2. 图像数据以合法 `FileUIPart` 格式传入 AI SDK，同时 LLM 能从模型消息中正确读到图像内容。
- R3. `image-generate` 工具在 ToolLoop 执行后，LLM 在下一步可直接"看见"所生成图像。
- R4. `image-fetch` 工具同 R3。

---

## Scope Boundaries

- 不修改数据库 schema 或存储层。
- 不更改前端 UI 渲染（`image-ref` 在客户端仍保持原样）。
- 不修改 `U5` 的历史图像注入逻辑本身（只修复其输出格式）。
- 不处理图像 size limit 或 provider 能否接受多模态工具结果（defer 到运行时报错）。

---

## Context & Research

### Relevant Code and Patterns

- `lib/ai/hydrate-images.ts` — 当前输出 `{ type: 'image', image: Buffer, mimeType }` 需改为 `{ type: 'file', mediaType, url: 'data:...;base64,...' }`
- `node_modules/ai/src/ui/validate-ui-messages.ts:60-65` — FileUIPart schema: `{ type: 'file', mediaType: string, url: string, filename?: string }`
- `node_modules/ai/src/ui/convert-to-model-messages.ts:107-116` — `isFileUIPart(part)` 时转为 `{ type: 'file', mediaType, data: part.url }`
- `node_modules/ai/src/prompt/create-tool-model-output.ts` — `tool.toModelOutput` 优先级高于 JSON fallback
- `node_modules/@ai-sdk/provider-utils/dist/index.d.ts:740-820` — `ToolResultOutput` 的 `content` 类型，含 `{ type: 'image-data', data: string, mediaType: string }`
- `lib/images/storage.ts` — `readImageBuffer(conversationId, imageId, mimeType)` 工具方法
- `lib/tools/image-generate.ts` — `createImageGenerateTool`，闭包内有 `conversationId`
- `lib/tools/image-fetch.ts` — `createImageFetchTool`，闭包内有 `conversationId`
- `tests/ai/hydrate-images.test.ts` — 现有测试期望 `type: 'image'`，须同步更新

### Institutional Learnings

- AI SDK v5 UIMessage 与 CoreMessage 是两套不同的类型体系；`{ type: 'image' }` 仅在 CoreMessage（`generateText` 输入）合法，在 UIMessage 中非法。

---

## Key Technical Decisions

- **FileUIPart URL 格式**：使用 `data:${mimeType};base64,${buffer.toString('base64')}` 内联 data URL，避免额外 HTTP 路由；`convertToModelMessages` 将其 `data: part.url` 传给 provider，各 provider 均接受 base64 data URL。
- **toModelOutput fallback**：若读文件失败，回落到 `{ type: 'json', value: output }`，避免崩溃。
- **toModelOutput 不影响 UIMessage**：`toModelOutput` 只在 `convertToModelMessages` 内被调用，用于重构 model messages；不影响 UIMessage 存储层（`parts.output` 仍是 JSON）。

---

## Implementation Units

- [ ] U1. **修复 hydrateImagesForLLM — 改用 FileUIPart**

**Goal:** 将所有 `{ type: 'image', image: Buffer, mimeType }` 替换为 `{ type: 'file', mediaType, url: 'data:...' }`，使输出通过 `validateUIMessages`。

**Requirements:** R1, R2

**Dependencies:** None

**Files:**

- Modify: `lib/ai/hydrate-images.ts`
- Modify: `tests/ai/hydrate-images.test.ts`

**Approach:**

- `HydratedPart` 类型改为 `{ type: 'file', mediaType: string, url: string } | unknown`
- 将两处 `{ type: 'image', image: buffer, mimeType }` 改为 `{ type: 'file', mediaType: image.mimeType, url: 'data:${image.mimeType};base64,${buffer.toString('base64')}' }`
- 更新测试：`imagePart.type === 'file'`，`imagePart.mediaType === 'image/png'`，`imagePart.url.startsWith('data:image/png;base64,')`

**Execution note:** 先修改测试让其失败（RED），再修改实现（GREEN）。

**Patterns to follow:**

- `node_modules/ai/src/ui/validate-ui-messages.ts` 中 `FileUIPart` schema
- `node_modules/ai/src/ui/convert-to-model-messages.ts` 中 `isFileUIPart` 处理

**Test scenarios:**

- Happy path: `image-ref` → 输出 part 的 `type` 为 `'file'`，`mediaType` 为 `'image/png'`，`url` 以 `'data:image/png;base64,'` 开头
- Happy path: U5 注入的 assistant 生图 → 输出 part 同样为 `file` 格式
- Edge case: `image-ref` 指向不存在的 imageId → part 被跳过（原有行为保持）
- Integration: 修复后调用方不再触发 Zod "must start with data-" 错误

**Verification:**

- `bun run test tests/ai/hydrate-images.test.ts` 全部通过
- `bun run dev` 下带图片上传的对话请求不再返回 500

---

- [ ] U2. **给 image-generate 工具添加 toModelOutput**

**Goal:** 工具执行后，LLM 在下一步 ToolLoop call 中可直接看到生成的图像字节。

**Requirements:** R3

**Dependencies:** None（可与 U1 并行）

**Files:**

- Modify: `lib/tools/image-generate.ts`
- Modify/Create: `tests/tools/image-generate.test.ts`

**Approach:**

- 在 `tool({ ... })` 内添加 `toModelOutput: async ({ output }) => { ... }`
- `output` 类型为 `{ imageId: string, mimeType: string, sizeBytes: number }`
- 调用 `readImageBuffer(conversationId, output.imageId, output.mimeType)`
- 返回 `{ type: 'content', value: [{ type: 'image-data', data: buffer.toString('base64'), mediaType: output.mimeType }] }`
- 捕获异常时 fallback：`{ type: 'json', value: output }`
- 需要 `import { readImageBuffer } from '../images/storage'`

**Execution note:** test-first，先写失败测试再实现。

**Patterns to follow:**

- `node_modules/@ai-sdk/provider-utils/dist/index.d.ts` 中 `ToolResultOutput` type
- `lib/images/storage.ts` 中 `readImageBuffer`

**Test scenarios:**

- Happy path: `toModelOutput` 被调用后返回 `{ type: 'content', value: [{ type: 'image-data', data: <base64>, mediaType: 'image/png' }] }`
- Error path: 图像文件不存在 → 回落到 `{ type: 'json', value: output }`

**Verification:**

- `bun run test tests/tools/image-generate.test.ts` 通过
- typecheck 无新增错误

---

- [ ] U3. **给 image-fetch 工具添加 toModelOutput**

**Goal:** 与 U2 相同，使 `image-fetch` 抓取图后 LLM 可在 ToolLoop 内立即看到图像。

**Requirements:** R4

**Dependencies:** None（可与 U1/U2 并行）

**Files:**

- Modify: `lib/tools/image-fetch.ts`
- Modify/Create: `tests/tools/image-fetch.test.ts`

**Approach:**

- 同 U2，在 `tool({ ... })` 添加 `toModelOutput`；`image-fetch` 工具的闭包已有 `conversationId`
- 使用 `readImageBuffer` 读取，返回相同 `content` 格式

**Execution note:** test-first。

**Test scenarios:**

- Happy path: `toModelOutput` 返回 `{ type: 'content', value: [{ type: 'image-data', ... }] }`
- Error path: 文件缺失 → fallback JSON

**Verification:**

- `bun run test tests/tools/image-fetch.test.ts` 通过
- typecheck 无新增错误

---

## System-Wide Impact

- **hydrateImagesForLLM 输出变更**：所有消费 `hydrateImagesForLLM` 的调用方（目前仅 `app/api/chat/route.ts`）无需修改，因为 `FileUIPart` 是合法 UIMessage 格式，`createAgentUIStreamResponse` 内部 `convertToModelMessages` 可正确处理。
- **toModelOutput 仅影响 LLM 输入**：不影响 UIMessage stream 或数据库持久化，`parts.output` 仍存 JSON。
- **测试同步**：需同步更新 `hydrate-images.test.ts` 中对 `type: 'image'` 的期望。

---

## Risks & Dependencies

| Risk                               | Mitigation                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Provider 不支持多模态 tool-result  | `toModelOutput` fallback 到 JSON，不崩溃；错误由 provider API 在运行时报告                        |
| base64 inline 大图像导致请求体过大 | 当前图像上限 10MB（image-fetch）/ provider 限制（image-generate），可接受；future work 可改为 URL |

---

## Sources & References

- `node_modules/ai/src/ui/validate-ui-messages.ts` — UIMessage part schema
- `node_modules/ai/src/ui/convert-to-model-messages.ts` — FileUIPart → FilePart 转换
- `node_modules/ai/src/prompt/create-tool-model-output.ts` — toModelOutput 调用路径
- `node_modules/@ai-sdk/provider-utils/dist/index.d.ts` — ToolResultOutput 类型
