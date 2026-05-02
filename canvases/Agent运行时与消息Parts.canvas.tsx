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
            <Text>`deps` 用于测试注入（prisma / model / toolsOverride），生产路径三个参数均为空，使用默认实例。</Text>
            <Table
                headers={['步骤', '操作']}
                rows={[
                    ['校验请求体', 'chatPostBodySchema.safeParse() 解析 conversationId 与 messages 数组；解析失败返回 400'],
                    ['读取 LLM 选型', 'getSelection(db, conversationId, "LLM") + getModel()；未选型或模型不存在返回 4xx'],
                    ['同步用户消息', 'clientMessages 存在时 syncIncomingClientUserMessages() 写 USER 消息；否则从 DB 加载历史消息'],
                    ['Continuation 判断', '末条 clientMessage 为 assistant 时：复用其 id 为 runId，从 DB 加载已有 parts 作为续写起点'],
                    ['组装工具集', 'buildAvailableTools(db, conversationId) → tools + descriptors'],
                    ['生成 system prompt', 'buildSystemPrompt(descriptors)，descriptors 决定 system prompt 中声明哪些工具'],
                    ['构建 Agent', 'buildAgent({ model, tools, instructions, onStepFinish, prepareStep, providerOptions })'],
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
                    ['onStepFinish', 'chat route 内联定义', '每步结束回调，负责 Parts 累积与持久化'],
                    ['prepareStep', 'chat route 内联定义', '每步开始前的消息预处理钩子（视觉注入用）'],
                    ['providerOptions', 'computeLlmChatProviderOptions()', '可选，provider-level 附加参数（如 thinking mode）'],
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

            <H2>UIMessage Parts 结构</H2>
            <Text>`parts` 是 Message 表中的 JSON 数组，每个元素有 `type` 字段区分类型，多步推理的 parts 在同一 Message 行中累积追加。</Text>
            <Table
                headers={['type', '关键字段', '写入时机']}
                rows={[
                    ['text', 'text: string', '模型输出纯文本时（可跨多步累积）'],
                    ['tool-call', 'toolCallId · toolName · args', '模型发起工具调用时'],
                    ['tool-result', 'toolCallId · toolName · result · state', '工具执行完成后；state = "input-available" 写入，由 patchToolResultsFromResponseMessages() 更新为 "output-available"'],
                ]}
                striped
            />

            <Divider />

            <H2>Continuation（审批续写）</H2>
            <Text>
                当用户在前端点击「确认」或「拒绝」工具调用时，`useChat` 将当前 Assistant 消息（含 `tool-call` part）连同审批结果作为末条 clientMessage（`role = assistant`）POST 回来。chat route 检测到末条消息为 assistant 后进入续写路径。
            </Text>
            <Card>
                <CardHeader>续写路径 vs. 新轮路径</CardHeader>
                <CardBody>
                    <Table
                        headers={['条件', 'runId', 'runningParts 初始值']}
                        rows={[
                            ['末条 clientMessage.role = user（新一轮）', 'crypto.randomUUID()', '空数组 []'],
                            ['末条 clientMessage.role = assistant（续写）', '= lastClientMsg.id', '从 DB 加载该 Message 的已有 parts'],
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
