import {
    Card,
    CardBody,
    CardHeader,
    Divider,
    H1,
    H2,
    Stack,
    Table,
    Text,
} from 'cursor/canvas'

export default function AgentRuntimeAndParts() {
    return (
        <Stack gap={24} style={{ padding: 24 }}>
            <Stack gap={6}>
                <H1>Agent 运行时与消息 Parts</H1>
                <Text tone="secondary">
                    覆盖从 `/api/chat` 接收请求到 Assistant 消息写入数据库的完整服务端逻辑，包括 `ToolLoopAgent` 的工作方式、UIMessage parts 的结构，以及 continuation（审批续写）机制。
                </Text>
            </Stack>

            <Divider />

            <H2>handleChatPost() 主流程</H2>
            <Text tone="secondary" size="small">`app/api/chat/route.ts` · `handleChatPost(req, deps)`</Text>
            <Text tone="secondary" size="small">
                客户端：`DefaultChatTransport` + `prepareSendMessagesRequest` → **`lib/chat/narrow-chat-transport-body.ts`** 只发 **user-turn**（末条 user 的 id + parts）或 **tool-approval**（assistantMessageId + approvals），**不** POST 整包 messages。
            </Text>
            <Text>`deps` 用于测试注入（prisma / model / toolsOverride），生产路径三个参数均为空，使用默认实例。</Text>
            <Table
                headers={['步骤', '操作']}
                rows={[
                    ['校验请求体', 'chatPostBodySchema：kind 为 user-turn | tool-approval；无效则 400'],
                    ['读取 LLM 选型', 'getSelection(db, conversationId, "LLM") + getModel()；未选型或模型不存在返回 4xx'],
                    ['user-turn', 'upsertUserMessageParts(messageId, parts)；跨会话 id 冲突 → 400'],
                    ['tool-approval', 'load assistant 行 → applyToolApprovalsToParts（批准→input-available；拒绝→output-denied + approval.reason）→ upsertAssistantMessage 写回 DB'],
                    ['从 DB 构图', 'listMessages → dbRowsToUiMessagesForHydrate → hydrateApiImageFilePartsForModel（解析 `/api/images/`）'],
                    ['runId / 续写起点', 'user-turn：新 runId + 空 runningParts；tool-approval：runId = assistantMessageId + DB 已合并后的 parts'],
                    ['组装工具集', 'buildAvailableTools(db, conversationId)'],
                    ['system prompt', 'buildSystemPrompt(descriptors)'],
                    ['构建 Agent', 'buildAgent({ …, prepareStep：route 内联 image-fetch 视觉注入, onStepFinish, providerOptions })'],
                    ['返回 stream', 'createAgentUIStreamResponse({ agent, uiMessages, generateMessageId: () => runId })'],
                ]}
                striped
            />

            <Divider />

            <H2>buildAgent() 与 ToolLoopAgent</H2>
            <Text tone="secondary" size="small">`lib/ai/build-agent.ts` · `buildAgent(options): ToolLoopAgent`</Text>
            <Text>
                对 AI SDK `ToolLoopAgent` 的薄封装，无额外逻辑。`ToolLoopAgent` 在每次运行时循环执行「LLM 推理 → 工具调用 → 工具结果回传 → 再推理」，直到模型停止调用工具（`finish_reason: stop`）。每个循环单元称为一个 step。
            </Text>
            <Table
                headers={['参数', '来源', '说明']}
                rows={[
                    ['model', 'buildLlmModel(modelRecord)', 'AI SDK LanguageModel 实例'],
                    ['tools', 'buildAvailableTools()', '当前请求的 ToolSet'],
                    ['instructions', 'buildSystemPrompt(descriptors)', 'system prompt 字符串，含工具声明'],
                    ['onStepFinish', 'chat route 内联定义', '每步结束：追加 parts、累加 usage、upsert assistant、image-fetch 合成 user 落库'],
                    ['providerOptions', 'computeLlmChatProviderOptions()', '可选，provider 级附加参数（如 thinking mode）'],
                ]}
                striped
            />

            <Divider />

            <H2>onStepFinish 回调链</H2>
            <Text>每个 step 结束后按顺序执行，保证 Assistant 消息的中间态持续写入 DB。断线或中断时不丢数据，续写时从最后写入状态恢复。</Text>
            <Table
                headers={['顺序', '操作', '函数位置']}
                rows={[
                    ['1', '将本步 step 事件追加为 parts（text / tool-call / tool-result）', 'lib/ai/step-to-parts.ts · appendStepToParts()'],
                    ['2', '用 response.messages 中的 tool-result 回填跨步骤的 input-available parts', 'lib/ai/step-to-parts.ts · patchToolResultsFromResponseMessages()'],
                    ['3', '累加本步 usage 到 runningUsage（inputTokens / outputTokens / totalTokens）', 'chat route 内联'],
                    ['4', 'upsert Assistant 消息到 DB（id=runId，含 parts + usage + modelIdAtTime）', 'lib/db/messages.ts · upsertAssistantMessage()'],
                    ['5', '处理本步中的 image-fetch 批次（DB 路径写入 vision user 消息）', '详见「视觉上下文注入」画布'],
                ]}
                striped
            />

            <Divider />

            <H2>Composer 用户上传附图（独立于 image-fetch 工具链）</H2>
            <Text tone="secondary" size="small">`ComposerAttachments.tsx` · `POST /api/images` · `lib/ai/user-attach-xml.ts` · `lib/ai/normalize-user-image-parts.ts`</Text>
            <Text>
                对话页在「用量与选型」带之下另有独立附件区，与 `ComposerImageSlot`（主/次生图模型与尺寸）视觉分离。用户选图后先 `POST /api/images`（`conversationId` + `file`）校验并 `createImage`，`source = USER_UPLOAD`。发送时该轮 user 消息的 `parts` 依次为：前置结构化说明文本（`buildUserAttachXml`，根元素 `agent-image-user-attach`，slot / imageId / mimeType 与后续 file 顺序一致）、可选的用户自写正文、按 slot 顺序排列的 file part（长期真源为 `/api/images/[id]` 引用，不把大体积 base64 持久化在消息里）。`ChatPage` 渲染用户气泡时对 inject 文本做隐藏，对 `/api/images/` 与 `data:image/` 走图像展示分支。
            </Text>
            <Table
                headers={['环节', '说明']}
                rows={[
                    ['上限与校验', '`lib/image-upload-limits.ts`：`USER_ATTACH_MAX_IMAGES` 等与抓取侧常量对齐思路；MIME / `MAX_IMAGE_BYTES` 与上传路由校验一致'],
                    ['send 按钮', '`lib/chat-guard.ts`：`hasAttachments` 时允许纯图无字发送'],
                    ['进模型前', '`hydrateApiImageFilePartsForModel` 在 `createAgentUIStreamResponse` 之前执行，避免 Provider 无法解析相对 `/api/images/...`'],
                ]}
                striped
            />

            <Divider />

            <H2>UIMessage Parts 结构</H2>
            <Text>`parts` 保存在 Message **`payload.parts`**（Json）中，每个元素有 `type` 字段；多步推理在同一 assistant 行中累积追加。</Text>
            <Table
                headers={['type', '关键字段', '写入时机']}
                rows={[
                    ['text', 'text: string', '模型输出纯文本时（可跨多步累积）；用户消息也可含说明性 text（如 user-attach XML）'],
                    ['file', 'url · mediaType 等（AI SDK file part）', '用户附图消息：持久化以 `/api/images/{id}` 为主；Assistant 侧亦可出现工具相关展示'],
                    ['tool-call', 'toolCallId · toolName · args', '模型发起工具调用时'],
                    ['tool-result', 'toolCallId · toolName · result · state', '工具执行完成后；state = "input-available" 写入，由 patchToolResultsFromResponseMessages() 更新为 "output-available"'],
                ]}
                striped
            />

            <Divider />

            <H2>Continuation（审批续写）</H2>
            <Text>
                工具需审批时，用户确认/拒绝后 `useChat` 自动再发一轮；HTTP body 为 **`kind: tool-approval`**（`assistantMessageId` + `approvals`），由 **`buildNarrowChatPostBody`** 从末条 assistant 上 `approval-responded` 的 part 收集。服务端 **`applyToolApprovalsToParts`** 将 DB 中仍为 `approval-requested` 的 part 按 HTTP 决策推进，再 **`listMessages` 构图** 续跑 Agent。
            </Text>
            <Card>
                <CardHeader>续写路径 vs. 新轮路径</CardHeader>
                <CardBody>
                    <Table
                        headers={['条件', 'runId', 'runningParts 初始值']}
                        rows={[
                            ['kind = user-turn（新一轮用户发言）', 'crypto.randomUUID()', '空数组 []'],
                            ['kind = tool-approval（审批后自动提交）', '= assistantMessageId', 'applyToolApprovalsToParts 之后写回 DB，再读出合并后的 parts'],
                        ]}
                        striped
                    />
                </CardBody>
            </Card>

            <Divider />

            <H2>Usage 累加</H2>
            <Text>
                `runningUsage` 在每次 `onStepFinish` 中逐步叠加 `step.usage.inputTokens / outputTokens / totalTokens`，随 `upsertAssistantMessage()` 写入 Message 行。数据来源仅为 API 响应字段，不做本地估算。续写轮从 DB 加载上轮已有 usage 作为累加起点，不从零开始。
            </Text>
            <Text tone="secondary" size="small">
                stream 结束时，`createAgentUIStreamResponse` 的 `messageMetadata` 回调从 `finish` part 的 `totalUsage` 字段读取最终用量，随流推送给前端用于 ContextUsageBar 展示。
            </Text>
        </Stack>
    )
}
