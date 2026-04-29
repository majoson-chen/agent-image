# 对话页模型选择带：布局、弹层统一设置、LLM 思考模式（构思，2026-04-30）

**范围：** `ChatPage` 输入区上方的 LLM / 主生图 / 次生图选择带；与 `ConversationModelSelection`、`ImageModelPicker`、`LlmModelPicker`、chat Route 编排。

**当前基线（代码扫描）：**

- 用量环 + 三个 Picker 同列 `flex-wrap items-end`，间距与「裸 select」堆叠容易显乱。
- 生图 Picker：模型与分辨率是**上下两个** `select`，wrap 时像「两行子设置」。
- `ConversationModelSelection.params` 对 `IMAGE_*` 存 `{ size }`；**LLM 的 params 恒为可选扩展位**，当前 `setLlmSelectionAction` 未写入 params。
- `buildLlmModel` + `buildAgent` **未**根据会话选择附加 `providerOptions`（思考类能力尚未接线）。

---

## 幸存者（建议进入 ce-brainstorm / ce-plan）

| 方向                                          | 摘要                                                                                                                                                                                                                     | 为何留下                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **A. 单带「摘要按钮 + 弹层」**                | 每个槽位（LLM / 主 / 次生）显示**一行摘要**（当前模型名截断 + 关键子项，如尺寸 / 思考开），点击打开 **daisyUI `dialog`** 或 **dropdown+panel**，在弹层内完成：模型列表 + 子设置，**同一视口内**不再上下两个裸 select。   | 直接解决「丑」与「不要两行」；与现有 modal 语言一致。 |
| **B. 主带只保留「紧凑梗概」**                 | 主区域保留用量环 + 最多三个 **等宽 `join`/`btn` 脸** 的触发器，避免多控件基线不齐；图标可用 lucide（`Settings2`、`Cpu`、`Image`）辅助扫描。                                                                              | 降低视觉噪音，对齐设计系统。                          |
| **C. LLM 思考开关放 LLM 弹层内**              | 当且仅当**模型声明支持**思考能力时，在 LLM 弹层中显示 **toggle**（daisyUI `toggle`），写入 `selection.params`（如 `{ thinkingEnabled: true }`）。不支持则**不显示**（不是灰色禁用占坑）。                                | 符合「如支持」；避免对所有模型误暴露无效开关。        |
| **D. 能力声明进 `Model.capabilities`（LLM）** | 在 JSON 中增加约定字段，例如 `supportsThinking?: boolean` 或 `thinking?: { mode: 'alibaba-qwen' }`，由设置页或预设模板填好；对话页只读展示开关。                                                                         | 单一数据源，避免硬编码 model name。                   |
| **E. 服务端接线**                             | `getSelection(..., 'LLM')` 读出 `params`，在 `handleChatPost` 构建 agent 时合并进 **AI SDK 支持的 `providerOptions`/等价参数**（需按 `@ai-sdk/alibaba` / OpenAI 文档逐 provider 映射）。无映射能力时 UI 仍可不展示开关。 | 否则开关仅为 UI 假象。                                |

---

## 明确拒绝（本轮不采纳或后延）

| 想法                             | 理由                                                   |
| -------------------------------- | ------------------------------------------------------ |
| 全局一个「超级弹层」里选三种模型 | 认知负荷高、易误触；与「按槽位独立」心智不符。         |
| 思考开关做在**设置页**而非对话页 | 与「按会话实验开/关」冲突；会话级 params 更合适。      |
| 所有 LLM 都画一个禁用态「思考」  | 违背「如支持」；增加噪音。                             |
| 为美观去掉「未选」与空态链到设置 | 违反 R3 / 现有产品行为；仅可改变呈现形式不可去掉能力。 |

---

## 实现时风险与待证实点

1. **Provider 真支持：** `@ai-sdk/alibaba` / OpenAI / Compatible 对「思考 / reasoning」的 **官方参数名**需查当前版本文档；若暂无统一 API，**E** 应拆成「先能力位 + UI + 存 params，再逐个 provider 接线」。
2. **流式与 usage：** 思考模型可能多一段 hidden reasoning，需确认 `step-to-parts` / 前端是否需隐藏或折叠（可二期）。
3. **迁移：** 无需 DB migration；仅为 `params` 增量与 `capabilities` schema 约定扩展。

---

## 建议下一手

- **ce-brainstorm**：收紧 A+B 的交互稿（弹层结构、摘要文案规则、移动端 wrap 行为）。
- **ce-plan**：拆实施单元（新 client 组件如 `ComposerModelSlot`、扩展 `setLlmSelectionAction`、chat route `providerOptions`、Vitest 覆盖 params 持久化）。

_本文件为 ce-ideate 产出，非需求冻结；落地以 ce-brainstorm / ce-plan / PR 为准。_
