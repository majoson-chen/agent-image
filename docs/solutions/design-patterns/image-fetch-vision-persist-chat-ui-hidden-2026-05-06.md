---
title: image-fetch 视觉注入合成 user 不出现在聊天消息列表
date: 2026-05-06
category: design-patterns
module: agent-image chat / image-fetch vision
problem_type: design_pattern
component: assistant
severity: low
applies_when:
  - "实现或调整 `image-fetch` 在 `onStepFinish` 落库的合成 `USER` 消息（`buildVisionUserUiParts` 链）"
  - "在 `ChatPage` 或同类组件渲染 `messages` 列表，且历史中混有工具侧持久化的多模态 user 行"
tags:
  - image-fetch
  - vision-inject
  - chat-ui
  - message-list
  - hydrate
  - db-first
related_components:
  - database
  - documentation
---

# image-fetch 视觉注入合成 user 不出现在聊天消息列表

## Context

`image-fetch` 执行后，服务端在 `onStepFinish` 往 DB 写入一条 **`role = USER`** 的合成消息：首段为 `<agent-image-fetch-vision>` 说明文本，后续为与 slot 顺序一致的 `file` parts，用于**会话重载后的 hydrate 与模型侧多模态上下文**（见 `lib/ai/vision-inject-xml.ts`、`buildVisionUserUiParts`）。

曾有一段实现为**在聊天区单独分支**渲染该类消息（灰底 card + 实现向说明 + 缩略图），便于开发期确认落库与顺序。产品上这会被误认为「用户发了一条奇怪消息」，且文案暴露 DB/XML 细节，**不属于对话 transcript 应向最终用户展示的内容**。`lib/ai/vision-inject-xml.ts` 中 `isImageFetchVisionPersistParts` 的注释本就写明「整条不在 UI 展示」，与产品期望对齐后，应在列表层直接排除。

## Guidance

1. **列表渲染前过滤**：在 `ChatPage`（或任何消费 `useChat().messages` 的列表）中，对满足 **`m.role === 'user' && isImageFetchVisionPersistParts(m.parts)`** 的消息**不要渲染**（例如 `.filter(...)` 后再 `.map`），而不是为其实现单独的气泡或说明 card。
2. **不得依赖「用户看不到」来省略落库**：合成 user 行仍须写入 DB，供 `listMessages` → interleave / hydrate 路径恢复**模型**侧视觉上下文；仅**聊天 UI** 隐藏。
3. **与 Composer 用户消息区分**：用户从 Composer 上传的附图走 `agent-image-user-attach` 等路径，**应**以常规 user 蓝气泡展示；勿把过滤条件扩写到所有含 `file` 的 user 消息。判定以 **`isImageFetchVisionPersistParts`**（首 part 为 vision 注入 XML）为准。
4. **文档与画布**：若叙述「DB 路径」时，应写明该条**不在对话列表展示**，避免读者以为刷新后会在 UI 看到额外 user 气泡（仓库内 `canvases/视觉上下文注入.canvas.tsx` 已与此一致）。

## Why This Matters

若将 hydrate 专用行画进 transcript，会混淆**真人消息**与**工具副作用持久化**，并泄露实现细节；过滤掉不影响模型与 DB 行为，仅收紧呈现边界。

## When to Apply

- 新增或改版消息列表、thread 导出、分享视图时，凡数据源含完整 `Message` 历史，需沿用同一过滤规则（或等价Predicate），避免合成 vision user 意外泄漏到其他表面。

## Examples

**渲染列表（节选模式）：**

```tsx
{messages
    .filter((m) => !(m.role === 'user' && isImageFetchVisionPersistParts(m.parts)))
    .map((m) => (
        <div key={m.id}>{/* 原有 user / assistant 分支 */}</div>
    ))}
```

**检测逻辑（服务端/客户端共用）**：`@lib/ai/vision-inject-xml` 的 `isImageFetchVisionPersistParts`。

**回归测试**：`tests/conversations/ChatPage.test.tsx` 中 `image-fetch vision persist user (hidden)` 用例断言不出现对应 `/api/images/...` 预览图及旧版说明文案。

## Related

- 同仓 **Composer 用户上传**与 image-fetch 合成 user 的区分：`docs/solutions/design-patterns/composer-user-image-upload-multimodal-2026-05-03.md`
- **工具结果/批准**类运行时错误（另一议题）：`docs/solutions/runtime-errors/missing-tool-results-image-approval-ai-sdk-2026-05-03.md`
