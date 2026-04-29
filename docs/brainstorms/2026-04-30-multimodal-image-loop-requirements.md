---
date: 2026-04-30
topic: multimodal-image-loop
---

# agent-image：多模态图像闭环（需求）

与总览 [`2026-04-23-agent-image-requirements.md`](2026-04-23-agent-image-requirements.md) 及 playbook [`2026-04-23-agent-image-agent-playbook.md`](2026-04-23-agent-image-agent-playbook.md) 相容：补足 R18 在「图像参与多模态推理」侧的实现边界，并修复两条已知的 UI 重渲染缺陷，使 Agent「画完→自检→调整」工作流真正可用。

不引入新的 Model 类型，不修改 R3 / R9 的工具暴露规则，不修改 R15 的生图确认行为。

---

## Problem Frame

仓库当前存在一条隐蔽的**图像单向膜**：

1. **生图产物对 Agent 不可见**：assistant 调用主/次生图工具产生 `imageId` 之后，`lib/ai/hydrate-images.ts` 仅扫描 user message 中的 `image-ref` part，**不处理 assistant tool output**。下一轮 LLM 看到的只是 `imageId` 字符串——表现为 **Agent 在用户要求"再调一调"时无法看到产物，prompt 改写靠猜**。直接背离 Dependencies「LLM Vision 假设」与 playbook「先生图、再用 LLM 检查、不行就调整」的设计意图。R15 的 UI 确认闸约束的是"是否调用生图 API"，并不解决 Agent 自身在下一轮的 prompt 改写盲改问题。
2. **`image-search` 候选对 Agent 不可见**：`image-search` 返回 URL 列表；现有 `web-fetch` 仅取网页文本（`res.text()` + 50KB 截断），**无法把 URL 转成可注入 LLM 的图像字节**。Agent 拿到 URL 也没法"看一眼"再选。
3. **历史多模态上下文丢失（UI 现象）**：刷新对话后图片块不再显示。已定位到两条独立 UI bug——见下文 R-II-1 / R-II-2。

三件事**同根**：缺少一条「**任何来源的图都能被持久化定位 + 进入下一轮 LLM 多模态上下文**」的统一通路。

---

## Actors

- **A1. 终端用户（本人）：** 不感知多模态注入细节；只期望 Agent 真正"看到"画出来的图、并能在自检/调整时引用图像。
- **A2. Agent（服务端编排的 LLM）：** 在 vision 假设下，对会话内全部已落盘图像默认可见；可主动调用 `image-fetch` 把 `image-search` 中感兴趣的 URL 拉为可见图像。

---

## Key Flows

- **F1. 生图自检闭环**
    - **Trigger：** Agent 完成一次主/次生图工具调用并落盘 `imageId`，进入下一轮工具循环。
    - **Actors：** A2
    - **Steps：** 服务端在构造下一轮 LLM 请求时，把会话内**所有**已落盘图像（含本轮新生）按对话顺序注入对应位置的多模态上下文；Agent 据此判断是否再次发起生图、调整 prompt、或回复用户成稿。
    - **Outcome：** Agent 能基于真实图像作出自检与调整；R15 在再次生图时仍要求 UI 确认。
    - **Covered by：** R-I-1, R-I-3, R-I-5
- **F2. 候选图谱拉回**
    - **Trigger：** Agent 调用 `image-search`，得到一组 URL；判断需要"看清楚"其中某张以决定是否作为参考图或生图灵感。
    - **Actors：** A2
    - **Steps：** Agent 调用 `image-fetch(url)`，服务端 fetch（受 R12 + SSRF 约束）→ 校验 Content-Type 为图像 → 校验体积 → 落盘 → 创建 `Image` 行（新 `source` 枚举值）→ 返回 `imageId`。下一轮 LLM 请求按 F1 同一注入路径让 Agent 看到该图。
    - **Outcome：** Agent 完成"搜索 → 选图 → 看图 → 决定 → （可选）作为参考图喂给生图工具"链路。
    - **Covered by：** R-I-2, R-I-3, R-I-5
- **F3. 历史会话重载**
    - **Trigger：** 用户刷新或回到已有对话。
    - **Actors：** A1
    - **Steps：** SSR 从 DB 读取消息 `parts`，**完整保留** user 的 `image-ref` 与 assistant 的 `tool-image-generate-*` part（含 `output.imageId`）；前端按既有渲染分支显示参考图与生图结果。
    - **Outcome：** 重载后 UI 与流式期间一致；不丢图片。
    - **Covered by：** R-II-1, R-II-2

---

## Requirements

### 多模态闭环（核心新增能力，类 I）

- **R-I-1. 全量图像可见性（产品行为）：** 服务端在构造每一轮 LLM 请求时，须使会话内**所有**已落盘图像对 LLM 可见，按图像在对话时间线中产生的相对位置注入。覆盖三类来源：
    - user 上传的参考图（`Image.source = USER_UPLOAD`，已通过 `image-ref` part 落地）
    - 主/次生图工具产出（`Image.source = GENERATED`）
    - `image-fetch` 拉回的 URL 来源图（**新** `Image.source = URL_FETCHED`）

    **不做**滑动窗口、不做最近 N 张裁剪、不做本地 token 估算或裁剪——与 **R7「不做 compact」** 一致。token 超窗口由 LLM API 直接报错，按 **R16** 回传 Agent，由 Agent 文本告知用户（与 R6 / R7 对齐）。

    **注入约束（产品层最小集）：**
    - **唯一真源**：`Image` 表是图像可见性的真源；按 `imageId` 去重（同一 `imageId` 在同一轮 LLM 上下文中至多注入一次）。
    - **重复注入避免**：user message 内已经以 `image-ref` 形态承载的图像，不再被服务端重复注入为额外 image part。
    - **单图失败不阻断**：单张图读取/解码失败时，**仅跳过该 part**，不阻断当轮请求。失败事件以日志或调试信号呈现，不进入用户对话流。

- **R-I-2. 新工具 `image-fetch`：**
    - **暴露规则：** 与 `web-search` / `image-search` / `web-fetch` 同级——**无条件暴露**给 Agent（不绑定任何 Model 选型，不受 R3 / R9 主/次生图配置影响）。
    - **行为：** 服务端 fetch（与 R12 一致）→ 经 `lib/tools/ssrf-guard.ts` 校验仅允许公网 http(s) → fetch 时 `redirect: 'manual'`，对 3xx 响应显式读取 `Location` 头并**重过** `assertPublicHttpUrl`（防止 302 跳到内网），**设跳数上限** → 校验响应体 `Content-Type` 为受支持的图像 MIME，**并**对响应体首部做 magic-byte 嗅探（复用 `lib/images/mime.ts:detectMime`）；两者不一致或 magic-byte 检测不到 → 拒绝 → 检验响应体大小上限、整体超时上限、重定向跳数上限（**具体阈值**留 plan，但产品层声明三者**必须存在**） → 落盘 `data/images/<convId>/<imageId>.<ext>` → 创建 `Image` 行（`source = URL_FETCHED`，记录原始 URL）→ 返回 `{ imageId, mimeType, sizeBytes }`。
    - **输入形态（v1）：** 单张 `{ url: string }`。批量留 Deferred for later。
    - **不需要 R15 确认：** 见 Key Decisions 同名条目（含 prompt-injection 模型下的边界声明）。
    - **失败语义：** 非图 / magic-byte 不一致 / 超尺寸 / SSRF 拒绝 / redirect 跳数超限 / 网络错误 → 工具失败，按 R16 回传 Agent。
    - **删除语义：** 与 `GENERATED` 一致；对话删除时随 `data/images/<convId>/` 级联清理（与 R18 一致，**不**保留为「URL-only 不落盘」分支）。

- **R-I-3. 注入实现细化（约束，实现细节留 plan）：** 注入须在**服务端**完成；具体注入位置（user message vs 合成 user message vs `experimental_download` 钩子）由 plan 决定，但须满足下列产品层约束：
    - **保留来源信息（provenance）**：注入图像须以可读 prelude 文字标明来源——例如「以下图像来自上一轮工具调用产出」/「以下图像来自 image-fetch URL 抓取」/「以下图像来自用户上传的参考图」。**不得**让 Agent 误以为生图产物是用户新提供的参考图。
    - **provider 兼容子集**：实现须在覆盖率最广的 vision provider 子集上验证可用（具体白名单见 Outstanding Questions）。

- **R-I-4. 图像在持久化层的可寻址性精化（对 R18 的延伸）：**
    - `URL_FETCHED` 视作"已落盘的图像"，与 `USER_UPLOAD` / `GENERATED` 同等参与对话级联清理。
    - R18 中「URL-only 来源不下载、不落盘」的描述仍然适用于**未被 `image-fetch` 主动拉回的** `image-search` 结果——即 URL 列表本身不强制落盘，只有 Agent 显式选定时才转为 `URL_FETCHED`。
    - 不引入对外可见的 URL 表；记录原始 URL 仅供溯源/调试。

- **R-I-5. Vision 不可用时的兜底：** 与 Dependencies「LLM Vision 假设」一致——v1 默认假定用户配置的 LLM 支持 vision；若实际不支持，注入后由 LLM API 返回错误，按 R16 回传 Agent，由 Agent 文本告知用户。**不**做 Agent 自动切换 Model、**不**做 UI 强制按 Vision 能力过滤候选 Model。

### 已知 UI Bug 修复（类 II，无产品决策）

- **R-II-1. 重载时保留 user message parts：** `app/conversations/[id]/page.tsx` 中 SSR 转换 `initialMessages` 时，user 消息**不得**被强制塌成 `[{ type: 'text', text: m.content }]`；与 assistant 路径一致地优先使用 DB 持久化的 `m.parts`。**修复目标**：用户上传的参考图在刷新后仍可在历史消息中显示。

- **R-II-2. assistant tool 调用结果在持久化路径中保留 `output`：** 修正 `lib/ai/step-to-parts.ts`（或等价层）使得 `tool-image-generate-*` part 在 DB 中持久化的最终 `state` 为 `'output-available'` 且包含完整 `output.imageId(s)`，与流式期间 useChat 内部状态一致。**修复目标**：刷新后 `ImageGenerateBlock` 仍能渲染生图结果。

---

## Acceptance Examples

- **AE1. Covers R-I-1, R-I-3.** 用户在一个对话中先后让 Agent 生成图 A、再要求"把猫的颜色调浅一点"。第二次生图前的 LLM 调用，多模态上下文中包含图 A；Agent 输出的 prompt 与图 A 内容相关（例如「在原图基础上把毛色调浅」），而不是从零再生成。注入路径附带 provenance 文字，使 Agent 能区分"图 A 是上一轮自己产出的"而非"用户新提供的参考图"。

- **AE2. Covers R-I-2, R-I-3, F2.** Agent 调用 `image-search('柯基')` 得到 10 个 URL；选其中 2 张分别调 `image-fetch(url)`，得到 `imageId_1`、`imageId_2`。下一轮 LLM 请求中，Agent 能用文字描述这两张图的具体内容（毛色、姿势等），证明已"看到"。Agent 后续可把任一 imageId 作为参考图传给主生图工具。

- **AE3. Covers R-I-2.** Agent 调 `image-fetch` 一个非图 URL（如 HTML 页面）；服务端检测 `Content-Type` 非图像，工具返回失败；Agent 在文本中告知用户该 URL 不是图像。`Image` 表无新行写入。同样地，伪装 `Content-Type: image/png` 但首字节非 PNG/JPEG/WEBP/GIF 的响应（magic-byte 不一致）→ 工具失败。

- **AE4. Covers R-I-2, R-I-4.** 用户删除某条会话；该会话内通过 `image-fetch` 拉回的图像文件与 DB 行随之级联清理，与 `USER_UPLOAD` / `GENERATED` 行为一致。

- **AE5. Covers R-I-1, R-I-5, R7, R16.** 同一会话累计十几张图后某次 LLM 请求超窗口，LLM API 直接返回错误；服务端按 R16 把错误回传 Agent，Agent 通过文本告知"上下文已满，建议开新对话"；本地不做裁剪、不做摘要。

- **AE6. Covers R-II-1.** 用户上传一张参考图、发出生图请求、收到 Agent 文本回复；刷新页面后回到该对话，**用户消息中的参考图**仍能正常显示。

- **AE7. Covers R-II-2.** Agent 完成一次生图、UI 上正常显示结果图；刷新页面后回到该对话，assistant 消息中的**生图结果块**仍能显示该图（不退化为"准备执行"等中间状态）。

---

## Success Criteria

- Agent 能够在多轮对话中"看到"自己生成的图、用户上传的图、以及自己通过 `image-fetch` 拉回的图，并据此调整后续 prompt 或回复。
- `image-search → image-fetch → 主/次生图（带参考图）` 链路在单轮 Agent 工具循环中可行；用户在时间线中可见每一步工具调用与产物。
- 已有的"Agent 调完生图后图能正常显示"在刷新后保持一致——不再出现"图刷新就消失"的 UI 现象。
- 实现侧无需引入对话级 token 估算 / 摘要 / 滑窗逻辑（与 R7 一致）。

---

## Scope Boundaries

### v1 范围

- R-I-1（全量注入）、R-I-2（单张 `image-fetch`）、R-I-3（服务端注入约束）、R-I-4（`URL_FETCHED` source）、R-I-5（Vision 兜底）。
- R-II-1、R-II-2 两条 bug 修复。

**Shipping order（建议）：** Class II（R-II-1 / R-II-2）与 Class I 没有共享代码路径，**可独立 PR 先发**——避免被新工具 / 新注入策略的 plan 阶段问题拖延。Class I 后跟。本节不要求拆分需求文档；plan 阶段拆 milestone 即可。

### Deferred for later

- **`image-fetch` 批量入参**（一次拉多张）。当前若 Agent 需要多张，多次调用即可——粒度细、错误隔离好。
- **基于工具结果的 multi-part tool result 注入路径**（AI SDK `Tool.toModelOutput` + `{ type: 'content', value: [..., image-data] }`）：当前 v1 走 user message image part 路径以最大化 provider 兼容性；该路径作为可演进项保留，待 AI SDK 形成 capability 协商后再切。
- **AI SDK `{ type: 'execution-denied' }` 替换 R15 拒绝语义**：目前以 `errorText` 表达；可作为后续清理项与 SDK 原生语义对齐，**不**改变 R15 产品行为。
- **图像窗口策略**：图像 token 经济学（单张 1-2k tokens、按图独立计费、vision LLM 触顶速度比纯文本快）与 R7「不做 compact」前提相容但加速可能明显；当 vision token 加速撞墙体验出现后，再单独评估"图像滑窗 / 仅注入最近 N 张 / 退化为 imageId 文本"等策略。**与 R7 的文本 compact 解耦**——文本侧不动，图像侧单独议。
- **滑窗 / compact / 摘要**（文本层）：与 R7 一致延后。
- **`image-fetch` 与 `image-search` 的合并优化**（如让 `image-search` 直接落盘前 K 张候选）：v1 保持双工具职责清晰。

### Outside this product's identity

- 多用户图像配额。
- **图像内容审核 / NSFW 过滤**：v1 单机自用，不做。
- **针对 Agent 被 prompt-injection 劫持后的"任意公网内容入盘"语义防御**：v1 承认这一面（见 Dependencies），但不在产品层做主动防御（如内容指纹库、写盘 quota、回滚机制）。**与上一条"内容审核"是不同语义**：内容审核针对图像本身，"入盘语义防御"针对攻击者是否能借 Agent 把任意公网内容变成本机文件。
- CDN 化资源服务。
- 任何"绕过 R12 让浏览器直接 fetch 图像"的客户端实现。

---

## Key Decisions

- **注入主路径：user message image part**（路径 ①，**已选定**）。理由：覆盖 OpenAI / Anthropic / Google / 全部 OpenAI-compatible 国产 vision provider；与现有 `hydrate-images` 模型同形扩展，改动面小；不引入 capability 元数据。**具体注入位置 / 拼装形态 / per-turn batched vs 逐图展开 vs `experimental_download` 钩子** 留 plan（见 Outstanding Questions）。
- **`image-fetch` 不需要 R15 确认（含边界）**：只读资源拉取——与 `web-fetch` / `image-search` 同档处理。**承认在 prompt-injection 威胁模型下，image-fetch 是把对手控制内容引入 LLM 视野的入口**，并非完全无副作用；该决定基于 v1 单机 toy 取舍（用户随时可见对话流并按 R19 中断）。多用户场景须重审。
- **`image-fetch` v1 单张入参**：批量延后。
- **`image-fetch` 独立工具 vs 让 `image-search` 直接落盘前 K 张候选**：保持独立工具。决定理由是**产品权衡**——Agent 决策粒度（"先看搜索结果 → 再选 → 再看图 → 再决定"链路对话语义清晰）优先于"少一次 round-trip"的速度。多 round-trip 成本作为已识别取舍接受。
- **新增 `Image.source = URL_FETCHED`**：与 `USER_UPLOAD` / `GENERATED` 同等被对话级联清理覆盖；记录原始 URL 仅供溯源。
- **不做 token 裁剪 / 滑窗（v1）**：图像规模带来的 token 上涨直接体现在 R6 用量条与 R7 撞墙路径；vision LLM 撞墙更快是已识别加速，对应策略见 Deferred「图像窗口策略」。
- **不区分"主/次生图产物"在注入侧的优先级**：两者在多模态上下文中以同一形态参与；R9「主/次为收费/能力不同的两条独立候选」语义不变。
- **`image-fetch` 暴露规则**：无条件暴露（与搜索/抓取系工具同档），不绑定任何 Model 选型。

---

## Dependencies / Assumptions

- LLM Vision 假设（与总览 Dependencies 一致）：v1 默认用户所选 LLM 支持多模态。
- `lib/tools/ssrf-guard.ts` 已具备公网 http(s) 字面量校验能力，可被 `image-fetch` 复用作为基线；**redirect 每跳重过校验** 与 **响应体 magic-byte 嗅探** 由 `image-fetch` 工具自行实现，不要求 ssrf-guard 升级。**已识别盲点**：现有 ssrf-guard 仅做主机名字面量私有 IP 校验，**无 DNS 解析**——攻击者可注册公网域名解析到内网 IP（DNS rebinding）；v1 单机 toy 接受该残余风险，多用户场景须升级。
- AI SDK 的 image part 接受 `Buffer` / `base64` / URL 三种形态；URL 形态下 SDK 默认下载器（或 `experimental_download` 自定义钩子）执行抓取——具体使用何种路径在 plan 阶段决定。
- 现有 `Image` 表 schema 能容纳新 `source` 枚举值；落盘路径规则（`data/images/<convId>/<imageId>.<ext>`）已稳定，沿用。
- **Adversarial image content（已识别威胁面）**：`image-fetch` / `image-search` 引入对手控制图像（包括嵌字 prompt-injection、设计成"指令性视觉"的图像）；vision LLM 处理时可能被劫持执行非用户意图的工具调用。**v1 不做内容侧防御**——依赖 user 见图时仍能识别异常并按 **R19** 中断本轮、依赖 R15 在生图工具处的 UI 闸；多用户场景须重审。

---

## Outstanding Questions

### Resolve Before Planning

- （暂无）

### Deferred to Planning

- **[Technical]** R-II-2 的具体修复路径：approval-gated 工具的 `tool-result` 在 AI SDK v5 ToolLoopAgent 中**出现在下一个 `onStepFinish` 调用**，当前 `step-to-parts.ts` 没有跨 step 维护"待补 output"的缓冲，于是丢弃。修复路径至少有两条：(a) 在 `step-to-parts` / 上层维持跨 step 的 callId → toolName 映射，使 step N+1 收到 `tool-result` 时能定位并 patch 已写入 part；(b) 改用 AI SDK 提供的 `responseMessages` / `response.messages` 作为权威持久化源，避免自行重建。需要核对 AI SDK v5 当前 API 形态后选定。
- **[Technical]** R-I-3 注入位置：批量塞到**最末一条 user message 之前**作为额外 user image part / 逐图按时间线展开为多条 synthetic user message / 用 `experimental_download` 让 SDK 自动按 URL 拉取——三种实现各有 token 与语义代价；须与 R-I-3 的 provenance 要求兼容（provenance prelude 文字如何与每张图对齐而不被 LLM 误读）。
- **[Technical]** **provider 兼容矩阵**：路径 ① 在不同 provider 上的实际行为有差异——Anthropic 要求 user/assistant 严格交替（不允许连续 user message）；部分国产 OpenAI-compatible vision 端点对 image part 形态要求不同（如必须 base64、不接受 URL；或必须用 `image_url` 字段而非 `image`）。plan 阶段须在覆盖率最广的 provider 子集上跑通——至少 **OpenAI / Anthropic / 通义 qwen-vl / Moonshot vision**。
- **[Technical]** `image-fetch` 的体积上限、超时、重试策略、redirect 跳数上限的**具体数值**；是否复用 `web-fetch` 的 `FETCH_TIMEOUT_MS = 30_000` 与 redirect 策略。
- **[Technical]** 注入路径下，user 上传图（已通过 `image-ref` part 持久化在 user message 内）是否仍走 hydrate 注入；与 assistant tool 产物的注入位置如何统一不重复（与 R-I-1「重复注入避免」约束一致）。
- **[Technical]** `image-fetch` 工具调用在前端时间线中的可视化形态（与现有 `tool-web-fetch` 等一致即可，沿用 `ToolCallBlock`）。

---

## Next Steps

- 进入 `docs/plans/` 下的 **`/ce-plan`** 做实现规划（origin：`docs/brainstorms/2026-04-30-multimodal-image-loop-requirements.md`）。
- 若需求有变，直接编辑本文件并保留 `date` / `topic`。
