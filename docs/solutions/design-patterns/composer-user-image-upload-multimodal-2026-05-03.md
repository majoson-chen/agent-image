---
title: Composer 用户图上传——原生多模态与 imageId 对齐
date: 2026-05-03
last_updated: 2026-05-03
category: design-patterns
module: agent-image chat / Composer
problem_type: design_pattern
component: assistant
severity: medium
applies_when:
  - "实现或评审「恢复用户上传」与相关 API/UI"
  - "扩展 user 消息 multimodal parts，避免回到 inject/hydrate hack"
tags:
  - composer
  - image-upload
  - multimodal
  - image-id
  - user-message
related_components:
  - documentation
---

权威拆任务与验收仍以 `docs/superpowers/specs/2026-05-03-feat-composer-user-image-upload-design.md` 为准；本文补充 **已实现代码锚点** 与 **落地过程中的取舍**（含 ce-compound Full 与会话历史摘要）。

# Composer 用户图上传——原生多模态与 imageId 对齐

## Context

`docs/plans/2026-04-30-007` 移除用户上传与 `image-ref` 等路径，动机是旧实现依赖**难维护的注入与 hack**，而非产品否定「用户给参考图」。对话内凡落库图像都应能抽象为同一 **`imageId`** 资产（生图产物、`image-fetch` 结果、用户上传等）。本期收敛范围：**先恢复用户上传**；**生图工具 `referenceImageIds` 另迭代**。

按 Superpowers 计划（spec + implementation plan）以 **TDD** 推进：独立模块测试、`POST /api/images`、Chat UI、`chat` 路由 hydrate、system prompt 微调与回归测试。

**Friction resolved during implementation（session history）**

- **客户端禁止引用带 `server-only` 的模块**：曾考虑在 Composer 侧复用 `lib/tools/image-fetch` 中的上限常量，但该文件标了 `server-only`，会搅乱客户端打包；改为无 `server-only` 的 **`lib/image-upload-limits.ts`**，上传张数与 **`IMAGE_FETCH_MAX_SOURCES`** 数值对齐（均为 10）。
- **文档表述**：user 消息应是 **多个 `parts`**（例如一个 text part 内含 `<agent-image-user-attach>`，再接 file parts），不能把「整条消息只是一段 XML」写成规范。
- **相对 URL 与 Provider**：持久化与 UI 传输可使用 **`/api/images/{id}`**；在进入模型前由 **`hydrateApiImageFilePartsForModel`** 将会话内合法引用展开为 **data URL**，避免服务端 `convertToModelMessages` 无法解析相对路径（session history）。

## Guidance

1. **不绑 `image-fetch` 工具链**
   上传与发送是用户发起的一条 **user 消息**；不需要调度 `image-fetch`。仅 **结构化说明文本**的形态可参考 `lib/ai/vision-inject-xml.ts`（slot ↔ imageId ↔ mimeType，与 file part **顺序一致**）；根元素独立为 **`agent-image-user-attach`**（`lib/ai/user-attach-xml.ts`），不强制与 `agent-image-fetch-vision` 共用同一模板。

2. **落库与引用**
   上传经服务端校验后 **`createImage`**，`source = USER_UPLOAD`。消息持久化以 **`imageId` + `/api/images/{id}`** 为主，避免大体量 base64 作长期真源。

3. **Composer UI**
   **独立附件区**（`ComposerAttachments`：缩略图 chip、删除）；**不得**与 `ComposerImageSlot`（主/次生**模型**选择）混同一控件语义。单条消息最多 **`USER_ATTACH_MAX_IMAGES`（10）**；**允许仅图无字**发送：`getSubmitButtonState` 增加 **`hasAttachments`**，有附件时 **`inputEmpty` 不再单独禁用发送**（`lib/chat-guard.ts`）。

4. **Chat 服务端**
   在 `createAgentUIStreamResponse` 之前对 **`uiMessages` 副本** 调用 **`hydrateApiImageFilePartsForModel`**（`lib/ai/normalize-user-image-parts.ts`）：扫描 user 消息中 `type: 'file'` 且 `url` 以 `/api/images/` 开头的 part，校验 **image 属于当前 conversation** 后换成为模型可消费的 **data URL**。

5. **`POST /api/images`**
   `FormData`：`conversationId`、`file`；校验会话存在、体积上限 **`MAX_IMAGE_BYTES`**、MIME 白名单；成功后返回 **`id` / `mimeType` / `sizeBytes`**。

6. **交付物**
   设计说明与 Canvas 同步要求见：`docs/superpowers/specs/2026-05-03-feat-composer-user-image-upload-design.md`。

### Implementation snapshot（当前仓库）

| 区域 | 路径 |
|------|------|
| 上传 Route | `app/api/images/route.ts` |
| Hydrate | `lib/ai/normalize-user-image-parts.ts` → `app/api/chat/route.ts` |
| XML 与标签 | `lib/ai/user-attach-xml.ts` |
| 上限常量 | `lib/image-upload-limits.ts`（`image-fetch` 与之共用数值） |
| 附件 UI | `app/conversations/[id]/ComposerAttachments.tsx`， wired in `ChatPage.tsx` |
| 发送闸门 | `lib/chat-guard.ts` |
| 模型说明 | `lib/ai/prompts/system.mustache.txt`（用户附件约定） |
| 测试 | `tests/ai/normalize-user-image-parts.test.ts`、`tests/ai/user-attach-xml.test.ts`、`tests/api/images/post.test.ts`、`tests/conversations/ChatPage.test.tsx`、`tests/lib/chat-guard.test.ts`、`tests/tools/image-fetch.test.ts` |

## Why This Matters

沿用 AI SDK **原生 user 多模态**（text + file parts）可避免再次引入 brittle 注入层；统一 **imageId** 便于后续把同一会话的任意图像接到生图参考等能力，而不分叉多套标识体系。服务端 **hydrate** 一步把「存储友好的 URL 引用」与「模型消费形态」解耦。

## When to Apply

- 接到「恢复上传 / 附件 / 参考图」类需求时，先读上述 **spec**，再动 `ChatPage`、`/api/images`、消息持久化。
- 改动视觉注入或 system prompt 时，区分 **用户上传说明块** 与 **`image-fetch` 合成 user**，避免文档与 prompt 歧义。
- 需要在前端与工具之间共享数值常量时，**优先**放在无 `server-only` 的共享模块，避免客户端误引服务端专用工具文件。

## Examples

**发送一条带附件的 user 消息（`ChatPage` 构造 `parts` 的顺序）**

1. 若有附件：先 push **`buildUserAttachXml(...)`** 的 **text part**。
2. 若有普通正文：再 push **用户文本** text part。
3. 按附件顺序逐个 push **`{ type: 'file', mediaType, url: '/api/images/{id}' }`**。

**宜**：用户选图 → `POST /api/images` 落库得 `id` → `sendMessage` 的 `parts` = `[ XML 文本 part, 可选用户文本, ...file parts ]`。

**不宜**：依赖已删除的专用 inject/hydrate hack；或通过隐藏中间消息「塞图」而不进标准 `messages` 形态；在 Client Component 中 import 带 **`server-only`** 的工具模块。

## Related

- `docs/superpowers/specs/2026-05-03-feat-composer-user-image-upload-design.md`（完整需求与 Canvas 表）
- `docs/superpowers/plans/2026-05-03-feat-composer-user-image-upload-plan.md`（实现任务拆解）
- `docs/plans/2026-04-30-007-feat-batch-image-fetch-and-vision-injection-plan.md`（移除上传与 R6 背景）
- `lib/ai/vision-inject-xml.ts`（slot 契约参考）
