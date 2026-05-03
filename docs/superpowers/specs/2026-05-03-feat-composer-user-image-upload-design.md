# Composer 用户图片上传恢复：需求与设计要点

## 背景与动机

- 历史上去掉「用户上传参考图」**不是因为产品不需要**，而是旧实现依赖**难维护的注入 / hack**，与「可维护、可对齐 AI SDK 原生多模态」的目标不符。
- 对话中凡是可见、已落盘的图像都应能抽象为**同一类资产**：具备稳定 **`imageId`**。来源包括：用户上传、模型生图产物、`image-fetch`（含从 `image-search` 拉取的 URL）等。**本期实现范围仅覆盖「恢复用户上传」**；生图工具 `referenceImageIds` 等能力**明确延后**。

## 目标

1. 用户在 Composer 中可选择图片附件；**上传即落库**，获得 **`imageId`**，与现有 `Image` 表及 `ImageSource.USER_UPLOAD`（或等价来源枚举）一致。
2. 用户发送消息时，该条 **user 消息**使用 **AI SDK 原生的多模态形态**（文本 part + 图像 file part），**不**依赖额外的 orchestration 注入消息、hydrate hack 或与 `image-fetch` 工具链耦合。
3. 用户消息中的**文本部分**在**用户自写内容之前**（或作为首段文本 part），附带一段**结构化说明**，用于告知模型各附件的 **`imageId` / `mimeType`** 及与 file part 的**顺序对应关系**。
4. 结构化说明的**写法参考** `lib/ai/vision-inject-xml.ts` 所采用的契约（**slot 序号、`imageId`、`mimeType`，且与紧随其后的 file part 顺序一一对应**）。**不要求**与 `image-fetch` 的合成 user 消息共用同一段 XML 模板或同一根元素名；若复用 helper 成本高，可**独立维护**用户上传专用格式，**允许与 fetch 注入块在格式上有差别**（实现阶段以可维护为准）。

## 非目标（本期不做）

- 不为用户上传走 **`image-fetch` 工具**；工具与合成注入链路仅作「文案形态」参考，**不**引入对本功能的运行时依赖。
- **不**实现 `image-generate-*` 工具的 **`referenceImageIds`** 或 Provider 侧参考图 API（另立迭代）。
- **不**恢复历史上与注入相关的不可维护路径（具体清单以实现阶段对照 `docs/plans/2026-04-30-007-feat-batch-image-fetch-and-vision-injection-plan.md` 删除项复核）。

## UI 要求

- **独立附件区域**：若用户附加图片，在 Composer **独立区域**展示（如缩略图 chip、删除），**不得**与 `ComposerImageSlot`（主/次生**模型与尺寸**选择）在视觉上混为一谈。
- 布局上与现有输入区的关系：在「用量 + LLM + 主生图 + 次生图」带**之下**、**文字输入 + 发送**之上（或等价：同一套层级内单独一条「待发附件带」），具体样式与 daisyUI 工具类在实现时贴合 `docs/design-language.md` 与 `ChatPage` 现状。

## 已收敛决策（与会话一致）

| 项 | 决定 |
| --- | --- |
| 单条 user 消息附件上限 | **10 张**（与 `IMAGE_FETCH_MAX_SOURCES` 对齐，见 `lib/tools/image-fetch.ts`）。 |
| 纯图发送 | **允许**（可无文字；需调整当前「仅根据文字是否为空」禁用发送的逻辑）。 |
| 持久化 | **先上传落库得 `imageId`**；写入消息的 **file part 以服务端可解析的引用为主**（如 **`/api/images/{id}`** 或等价），**不**将大体量 base64 作为长期真源。 |
| v1 交互 | **必选**：按钮选择文件 + chip 删除。**可选加分**：拖放到附件区（实现成本不高则做）。**剪贴板粘贴**可放 v1.1。 |
| 结构化 XML 根元素 | **独立根元素**（例如 `agent-image-user-attach`），内部仍遵循 slot ↔ imageId ↔ mimeType 与 file 顺序对齐；与 `agent-image-fetch-vision` **不强制**共用同一根名，必要时抽公共纯函数即可。 |

## 消息与数据（实现约束）

- **上传通道**：需恢复或新增受控的服务端能力（如 **`POST /api/images`** 或 Server Action），在完成校验（类型、大小等，可与 `image-fetch` URL 抓取侧约束对照）后 **`createImage`**，`source = USER_UPLOAD`，`conversationId` 绑定当前会话。
- **发往 `/api/chat` 的 `messages`**：`parts` 中含 **结构化说明文本 part**（前置）+ **按顺序排列的 file part**（与说明中 slot 一致）；路由与持久化层须能**稳定序列化/反序列化**该形态，刷新后时间线仍正确展示（可参考当前 `ChatPage` 对 user `file` + `data:image/` 的展示分支，迁移为以 **`/api/images/{id}`** 为主时为 **`<img src={...}>`** 或 Next 推荐方式）。
- **System prompt**：若需提示模型识别用户附件 XML 语义，在 `lib/ai/system-prompt.ts` 等处以**简短、可测试**方式增补；避免与 `image-fetch` 条款矛盾。

## 测试与验收建议

- 上传成功 → DB 有 `Image` 行 → 发送后消息落库 parts 含预期引用 → 刷新页面 user 气泡内仍可见图与可读说明（不要求用户肉眼读 XML，但结构须正确）。
- 边界：0 张 / 10 张、仅图无字、失败（超限 MIME、过大）提示。
- 默认 **TDD**：可测行为先写失败测试再实现（见 `AGENTS.md`）。

## 相关文件索引（实现时入口）

- 视觉注入契约参考：`lib/ai/vision-inject-xml.ts`
- 当前 Composer 与 user part 渲染：`app/conversations/[id]/ChatPage.tsx`
- 图像落库：`lib/db/images.ts`（及 `tests/db/images.test.ts`）
- 公开读图：`app/api/images`（GET 仍存在；上传需按本 spec 恢复）
- 历史移除上传与 R6 背景：`docs/plans/2026-04-30-007-feat-batch-image-fetch-and-vision-injection-plan.md`

## Canvas 同步（交付要求）

本功能落地后，**须**将人类可读的架构画布与实现对齐，避免 `canvases/` 与源码脱节（见 `AGENTS.md` Cursor Canvas 约定）。

| 画布文件 | 更新要点 |
| --- | --- |
| `canvases/Agent运行时与消息Parts.canvas.tsx` | 补充 Composer **独立附件区**、user 消息 **前置结构化说明 + file parts（`/api/images/{id}`）** 与发送路径；与纯文本-only 分支区分。 |
| `canvases/视觉上下文注入.canvas.tsx` | 标明 **用户上传**与 `image-fetch` **非同一工具链**，但 **slot / imageId / 顺序** 契约可对照；避免读者以为「只有 fetch 才有视觉注入」。 |
| `canvases/数据模型.canvas.tsx` | 若画布中 `ImageSource.USER_UPLOAD` 或上传入口描述仍写「已移除」，改为与 **`POST`/上传恢复** 后的真实路径一致。 |
| `canvases/架构总览.canvas.tsx` | 仅需在请求/数据流一句中点到 **用户上传 → 落库 → chat**（若总览已有类似句式则轻量修订）。 |

**时机：** 合并实现 PR 前或与之同批；若仅改 spec 未改代码，可暂不动画布，**代码合并后补更新**。

## 后续工作（不在本期 spec 内）

- `image-generate-*` **`referenceImageIds`** 与 `lib/image-provider-factory.ts` Provider 参考图请求体。
