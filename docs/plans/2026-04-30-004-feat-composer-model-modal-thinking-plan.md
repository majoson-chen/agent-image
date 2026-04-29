# 计划：对话区模型槽位弹窗 + LLM 思考模式（会话级）

**追溯：** `docs/ideation/2026-04-30-composer-model-row-modal-thinking.md`（及侧栏会话管理已实现部分复用对话框模式）。

## 需求要点（验收）

| ID  | 要求                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 对话页顶部「用量 + 三个模型槽」主区域不出现**两行独立 select**堆砌；各槽以**单行摘要控件**触发                                                                                                                           |
| R2  | 每个槽点开 **单个 `dialog`/`modal`**，在框内完成**模型选择与所有子选项**（生图：`尺寸`）                                                                                                                                 |
| R3  | **LLM** 在模型的 `capabilities.supportsThinking === true` 时，在同一弹框内展示**思考模式**开关；否则不展示                                                                                                               |
| R4  | 会话选择 `ConversationModelSelection.params` 对 LLM 持久化 `{ thinkingEnabled?: boolean }`；`/api/chat` 对阿里云模型将 `thinkingEnabled === true` 映射为 **`providerOptions.alibaba.enableThinking`**（经 `buildAgent`） |
| R5  | 设置页可为 **ALIBABA** LLM 标记「模型支持思考模式」（写入 `capabilities.supportsThinking`），供对话 UI 判断是否显示开关                                                                                                  |

## 实施单元（Execution）

- [ ] **`lib/`**：`llmSupportsThinking()`；`computeLlmChatProviderOptions(model, params)`（可测）。
- [ ] **`setLlmSelectionAction`**：`modelId` + 可选 params；清理时清空 params。
- [ ] **`buildAgent`**：`providerOptions?`。
- [ ] **`handleChatPost`**：读 selection.params，传入 `compute…`。
- [ ] **`ComposerLlmSlot` / `ComposerImageSlot`**：`ChatPage` 替换原有 Picker。
- [ ] **`page.tsx`**：下传 `capabilities`/`params`/`contextWindow` 等所需 props。
- [ ] **`AddLlmModelForm`**：阿里云时可选勾选「支持思考模式」→ `capabilities`。
- [ ] **测试**：provider options 单元测试；按需调整现有 chat 路由测试契约。
- [ ] **清理**：移除或保留未引用之 `LlmModelPicker` / `ImageModelPicker`（以无 dead import 为准）。

---

**Verification：** `bun run lint`、`bunx tsc --noEmit`、`bun run test run`。
