<!--
  ce-compound（lightweight）：会话内收敛的「恢复 Composer 用户上传」产品与技术要点。
  权威拆任务与验收仍以 `docs/superpowers/specs/2026-05-03-feat-composer-user-image-upload-design.md` 为准。
-->

---
title: Composer 用户图上传——原生多模态与 imageId 对齐
date: 2026-05-03
category: design-patterns
module: agent-image chat / Composer
problem_type: design_pattern
component: assistant
severity: medium
applies_when:
  - 实现或评审「恢复用户上传」与相关 API/UI
  - 扩展 user 消息 multimodal parts，避免回到 inject/hydrate hack
tags:
  - composer
  - image-upload
  - multimodal
  - image-id
  - user-message
related_components:
  - documentation
---

# Composer 用户图上传——原生多模态与 imageId 对齐

## Context

`docs/plans/2026-04-30-007` 移除用户上传与 `image-ref` 等路径，动机是旧实现依赖**难维护的注入与 hack**，而非产品否定「用户给参考图」。对话内凡落库图像都应能抽象为同一 **`imageId`** 资产（生图产物、`image-fetch` 结果、用户上传等）。本期收敛范围：**先恢复用户上传**；**生图工具 `referenceImageIds` 另迭代**。

## Guidance

1. **不绑 `image-fetch` 工具链**  
   上传与发送是用户发起的一条 **user 消息**；不需要调度 `image-fetch`。仅 **结构化说明文本**的形态可参考 `lib/ai/vision-inject-xml.ts`（slot ↔ imageId ↔ mimeType，与 file part **顺序一致**）；根元素可独立（如 `agent-image-user-attach`），不强制与 `agent-image-fetch-vision` 共用同一模板。

2. **落库与引用**  
   上传经服务端校验后 **`createImage`**，`source = USER_UPLOAD`。消息持久化以 **`imageId` + `/api/images/{id}`（或等价）** 为主，避免大体量 base64 作长期真源。

3. **Composer UI**  
   **独立附件区**（缩略图 chip、删除）；**不得**与 `ComposerImageSlot`（主/次生**模型**选择）混同一控件语义。单条消息最多 **10** 张；**允许仅图无字**发送（需调整发送按钮可用条件）。

4. **交付物**  
   设计说明与 Canvas 同步要求见：`docs/superpowers/specs/2026-05-03-feat-composer-user-image-upload-design.md`。

## Why This Matters

沿用 AI SDK **原生 user 多模态**（text + file parts）可避免再次引入 brittle 注入层；统一 **imageId** 便于后续把同一会话的任意图像接到生图参考等能力，而不分叉多套标识体系。

## When to Apply

- 接到「恢复上传 / 附件 / 参考图」类需求时，先读上述 **spec**，再动 `ChatPage`、`/api/images`、消息持久化。
- 改动视觉注入或 system prompt 时，区分 **用户上传说明块** 与 **`image-fetch` 合成 user**，避免文档与 prompt 歧义。

## Examples

- **宜**：用户选图 → `POST` 落库得 `id` → `sendMessage` 的 `parts` = `[ 结构化 XML 文本, ...file parts 按 slot 顺序 ]`，file 指向 `/api/images/{id}`。  
- **不宜**：依赖已删除的 `hydrate`/`image-ref` 专用注入；或通过隐藏中间消息「塞图」而不进标准 `messages` 形态。

## Related

- `docs/superpowers/specs/2026-05-03-feat-composer-user-image-upload-design.md`（完整需求与 Canvas 表）
- `docs/plans/2026-04-30-007-feat-batch-image-fetch-and-vision-injection-plan.md`（移除上传与 R6 背景）
- `lib/ai/vision-inject-xml.ts`（slot 契约参考）
