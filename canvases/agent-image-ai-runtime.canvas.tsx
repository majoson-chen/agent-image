import { Callout, Code, Divider, H1, H2, Stack, Table, Text } from 'cursor/canvas'

export default function AgentImageAiRuntimeCanvas() {
    return (
        <Stack gap={20}>
            <H1>AI 运行时：ToolLoopAgent 与 /api/chat</H1>
            <Text tone="secondary" size="small">
                锚点源码：
                {' '}
                <Code>app/api/chat/route.ts</Code>
                {' '}
                ·
                {' '}
                <Code>lib/ai/build-agent.ts</Code>
                {' '}
                · AI SDK
                {' '}
                <Code>ToolLoopAgent</Code>
                {' / '}
                <Code>createAgentUIStreamResponse</Code>
            </Text>

            <H2>为何是这一套 API</H2>
            <Table
                headers={['决策', '原因（与实现一致）']}
                rows={[
                    [
                        '每请求 new ToolLoopAgent',
                        '本会话 LLM、工具集、system prompt 都依赖当次 DB 状态；无法在进程级单例 Agent。',
                    ],
                    [
                        'createAgentUIStreamResponse',
                        '把循环结果打成 UI message stream，与客户端 useChat 同一协议；比手写 streamText→UI 转换集中。',
                    ],
                    [
                        'req.signal 传入',
                        '用户 stop → fetch abort → 工具内 fetch 与 Agent 共用 `abortSignal`（R19）。',
                    ],
                ]}
            />

            <Divider />

            <H2>请求入口：handleChatPost 主干</H2>
            <Table
                headers={['阶段', '行为', '模块']}
                rows={[
                    ['校验', 'Zod `chatPostBodySchema`：conversationId + 可选 messages 数组', '`lib/validation/chat-post-schema.ts`'],
                    ['LLM 门禁', '无 `ConversationModelSelection` LLM → 400；再 `getModel`', '`lib/db/selections.ts`、`models.ts`'],
                    ['构造 model', '`buildLlmModel(record)`：OPENAI / OPENAI_COMPATIBLE / ALIBABA', '`lib/llm-provider-factory.ts`'],
                    [
                        'providerOptions',
                        '仅 ALIBABA 且 capabilities 支持 thinking 且会话 params 开启时：`enableThinking`',
                        '`lib/llm-chat-provider-options.ts`',
                    ],
                    ['历史消息', '有 body.messages → 先 `syncIncomingClientUserMessages`（只 upsert user）；无则从 DB `listMessages` 组装', '`lib/db/messages.ts`'],
                    ['工具 + 指令', '`buildAvailableTools` → descriptors → `buildSystemPrompt`（Mustache）', '`tool-registry.ts`、`system-prompt.ts`'],
                    ['runId / parts', '见下节「延续轮」', 'route 内'],
                    ['agent + 流', '`buildAgent` + `createAgentUIStreamResponse`', 'route'],
                ]}
            />

            <Divider />

            <H2>runId 与「延续 assistant」轮</H2>
            <Callout tone="info" title="易混点">
                当客户端最后一条消息是
                {' '}
                <Code>assistant</Code>
                （例如 R15 批准后 useChat 自动再 POST），服务端必须复用**同一条** DB assistant 行的 id，否则会出现两条 assistant 或流合并失败。
            </Callout>
            <Table
                headers={['条件', 'runId', 'runningParts 起点']}
                rows={[
                    ['末条 client 消息为 assistant', '等于该条 id', '从 DB `message.findUnique` 读 parts + 累计 usage'],
                    ['否则（新 user 发话）', '`randomUUID`', '空数组，逐步 append'],
                ]}
            />
            <Text tone="secondary" size="small">
                延续判据用「最后一条 client 消息」而非 `findLast(assistant)`，避免出现 user 新消息仍绑到旧 assistant id 导致排序错乱（注释写在 route 内）。
            </Text>

            <Divider />

            <H2>prepareStep：image-fetch 后的多模态注入</H2>
            <Text>
                模型在**这一轮**里已调用
                {' '}
                <Code>image-fetch</Code>
                {' '}
                并得到 tool-result，但下一步 LLM 调用需要**像素**时，仅靠文本 JSON 不够。`prepareStep` 在下一步前把「含 file 与/或文本说明」的 user
                {' '}
                <Code>ModelMessage</Code>
                {' '}
                追加到 messages 末尾，且**不计入**最终对用户展示的 UIMessage 流（视觉注入是模型上下文侧车）。
            </Text>
            <Table
                headers={['步骤', '逻辑']}
                rows={[
                    ['提取批次', '`extractImageFetchBatchesFromStep` 从上一步 content 里找 image-fetch 的成功项', '`image-fetch-vision-injection.ts`'],
                    ['去重', '`modelInjectedImageFetchToolCallIds` Set；每 toolCallId 只注入一次'],
                    ['构造消息', '`buildVisionUserModelMessage`：读 storage、组多模态', '同文件'],
                    ['DB 镜像（尽力）', '`onStepFinish` 里 `createUserMessageWithParts` 写入与注入对齐的 user 行，便于重载会话', '`lib/db/messages.ts`'],
                ]}
            />
            <Text tone="secondary" size="small">
                若 DB 镜像失败，route 会 `console.warn`：模型本轮已看到像素，但刷新后可能丢视觉上下文。
            </Text>

            <Divider />

            <H2>onStepFinish：落库与 usage 累计</H2>
            <Table
                headers={['动作', '说明']}
                rows={[
                    ['appendStepToParts', '把本步 text / tool-call / tool-result 转成 UI parts（含 `step-start` 分隔）', '`step-to-parts.ts`'],
                    ['patchToolResultsFromResponseMessages', '把跨 step 才出现的 tool-result 回填 `input-available` part（审批路径）', '同文件'],
                    ['usage 累加', 'step.usage 字段按步叠加到 runningUsage', 'route 内'],
                    ['upsertAssistantMessage', '同 runId upsert：`content` 从 text parts 拼出，parts 存 JSON', '`messages.ts`'],
                ]}
            />

            <Divider />

            <H2>流元数据与客户端用量条</H2>
            <Text>
                <Code>messageMetadata</Code>
                {' '}
                仅在 stream part
                {' '}
                <Code>finish</Code>
                {' '}
                时挂上
                {' '}
                <Code>usage</Code>
                ；ChatPage 从最后一条 assistant 的
                {' '}
                <Code>metadata.usage</Code>
                {' '}
                取数；
                {' '}
                <Code>ContextUsageBar</Code>
                {' '}
                在
                {' '}
                <Code>totalTokens == null</Code>
                {' '}
                时不渲染（初始 SSR 消息通常尚无 metadata，须等流结束才有环）。
            </Text>

            <Divider />

            <H2>build-agent 未显式配置的点</H2>
            <Text tone="secondary" size="small">
                <Code>lib/ai/build-agent.ts</Code>
                {' '}
                只传入 model、instructions、tools、onStepFinish、可选 prepareStep / providerOptions。**未**在本文件写 `stopWhen`；步数上限依赖 AI SDK 默认（与早期 M2 计划里「显式 stepCountIs(20)」的叙述可能不一致，以当前源码为准）。
            </Text>

            <Divider />

            <H2>相关画布</H2>
            <Table
                headers={['文件', '内容']}
                rows={[
                    ['消息与parts模型.canvas.tsx', 'parts 形态与 DB 同步'],
                    ['工具注册与审批.canvas.tsx', '工具注册与 R15'],
                    ['模型工厂与会话选型.canvas.tsx', 'LLM/生图工厂与会话选型'],
                ]}
            />
        </Stack>
    )
}
