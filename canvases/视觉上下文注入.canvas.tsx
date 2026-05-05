import {
    Callout,
    Divider,
    H1,
    H2,
    Stack,
    Table,
    Text,
    useHostTheme,
} from 'cursor/canvas'

export default function VisionInjection() {
    const theme = useHostTheme()

    return (
        <Stack gap={24} style={{ padding: 24 }}>
            <Stack gap={6}>
                <H1>视觉上下文注入</H1>
                <Text tone="secondary">
                    `image-fetch` 工具执行后只向 `ToolLoopAgent` 返回 `imageId` 字符串，LLM 无法直接感知图像内容。视觉注入机制通过两条独立路径解决这个问题：一条在推理时让 LLM 看到图像（Model 路径），另一条将图像消息写入 DB 使 UI 重载时可恢复视觉上下文（DB 路径）。
                </Text>
                <Text tone="secondary">
                    Composer 用户上传不经过 `image-fetch`，也不走本页的 `extractImageFetchBatchesFromStep` / `buildVisionUserModelMessage` 链路：用户在客户端 `POST /api/images` 落库后，由常规 user 多模态消息（前置 `agent-image-user-attach` 说明 + 顺序一致的 file part）进入 `/api/chat`。与下表 image-fetch 工具链不同，但若需对齐「slot ↔ imageId ↔ mimeType ↔ file 顺序」的契约，可对照 `lib/ai/user-attach-xml.ts` 与 `lib/ai/vision-inject-xml.ts`（根元素名不必相同）。
                </Text>
            </Stack>

            <Divider />

            <H2>用户上传 vs image-fetch（对照）</H2>
            <Table
                headers={['维度', 'Composer 用户上传', 'image-fetch 视觉注入（本文余下章节）']}
                rows={[
                    ['触发', '用户选图 → `POST /api/images` → 发送消息', '模型调用 `image-fetch` 工具'],
                    ['LLM 看到图的方式', 'user 消息已含 file part；路由内 `hydrateApiImageFilePartsForModel` 展成 data URL 再交给 Agent', '`prepareStep`：在**下一步**模型调用前把上一 step 的 image-fetch 结果拼成 ModelMessage user（含 file Buffer），见 `buildVisionUserModelMessage`'],
                    ['DB 用户消息', 'USER 消息即含附图 parts（引用 URL）', '`onStepFinish` 内 `buildVisionUserUiParts` + `createUserMessageWithParts`，刷新后 UI 可见'],
                ]}
                striped
            />

            <Divider />

            <H2>关键函数</H2>
            <Text tone="secondary" size="small">`lib/ai/image-fetch-vision-injection.ts`</Text>
            <Table
                headers={['函数', '输入', '输出', '调用位置']}
                rows={[
                    [
                        'extractImageFetchBatchesFromStep(step)',
                        'AI SDK step 的 `content`（含 tool-result）',
                        '`ImageFetchBatch[]`',
                        '`prepareStep`（注入模型）与 `onStepFinish` 内合并后持久化',
                    ],
                    [
                        'buildVisionUserModelMessage(prisma, conversationId, batches)',
                        '待注入批次列表',
                        '`ModelMessage`（user，content 含 text + `file` Buffer）',
                        '**`prepareStep`**（`app/api/chat/route.ts` 内联）：追加到**下一步**发往 provider 的 messages',
                    ],
                    [
                        'buildVisionUserUiParts(prisma, conversationId, batches)',
                        '待持久化批次列表',
                        'UIMessage parts 数组（含 image part）',
                        'onStepFinish — 持久化到 DB（UI 重载可见）',
                    ],
                ]}
                striped
            />

            <Divider />

            <H2>prepareStep 路径（Model 路径）</H2>
            <Text tone="secondary" size="small">
                在 `app/api/chat/route.ts` 的 `buildAgent(
                { prepareStep }
                )` 中传入。
            </Text>
            <Text>
                **`steps.length === 0`**（首轮）跳过。之后每一步开始前：取 **上一 step** 的 `content`，`extractImageFetchBatchesFromStep` 得到批次；去掉已在 **`modelInjectedImageFetchToolCallIds`** 中的 `toolCallId`；对剩余批次 `buildVisionUserModelMessage`，将返回的 user `ModelMessage` **追加**到当前 step 的 `messages` 末尾，并以
                {' '}
                <code>{'{ messages: [...] }'}</code>
                {' '}
                形式返回。这样「刚抓取完图」后的**下一轮** LLM 调用能直接看到像素，符合 SPEC G5 同请求续轮语义。
            </Text>
            <Table
                headers={['操作', '细节']}
                rows={[
                    ['跳过首步', 'steps.length === 0 时直接返回 {}，无上一步可检查'],
                    ['去重过滤', '过滤掉 toolCallId 已在 modelInjectedImageFetchToolCallIds 中的批次'],
                    ['无待注入', 'pending.length === 0 时返回 {}，不修改消息链'],
                    ['注入', 'buildVisionUserModelMessage() 构造 vision user message，返回 { messages: [...messages, visionUser] }'],
                    ['标记已注入', '将本批次 toolCallId 加入 modelInjectedImageFetchToolCallIds'],
                ]}
                striped
            />

            <Divider />

            <H2>onStepFinish 路径（DB 路径）</H2>
            <Text>
                在 `onStepFinish` 回调末段执行（`upsertAssistantMessage()` 完成之后）。提取本步 `image-fetch` 批次，过滤掉已落库的（查询 `dbPersistedImageFetchToolCallIds`），调用 `buildVisionUserUiParts()` 得到 UIMessage parts，再通过 `createUserMessageWithParts()` 在 DB 中创建一条 `role = USER` 的消息记录。该条 **不在对话 UI 列表展示**（仅存 DB / hydrate，供会话重载后模型侧恢复视觉上下文；与 Composer 用户附图蓝气泡区分）。
            </Text>

            <Divider />

            <H2>两个去重集合</H2>
            <Text>两个集合在每次 `handleChatPost()` 调用时创建，请求结束后销毁，各自防止各自路径在多步推理中重复处理同一次 `image-fetch` 工具调用。</Text>
            <Table
                headers={['集合', '管辖路径', '防止的重复行为']}
                rows={[
                    [
                        'modelInjectedImageFetchToolCallIds',
                        'prepareStep（Model 路径）',
                        '同一 toolCallId 重复注入 AI 消息链',
                    ],
                    [
                        'dbPersistedImageFetchToolCallIds',
                        'onStepFinish（DB 路径）',
                        '同一 toolCallId 重复写入 DB user 消息',
                    ],
                ]}
                striped
            />

            <Divider />

            <H2>DB 路径失败处理</H2>
            <Callout tone="warning" title="非致命失败">
                DB 路径（`buildVisionUserUiParts` + `createUserMessageWithParts`）抛出异常时，chat route 仅打 `console.warn`，不中断当前推理。同请求内 **Model 路径（prepareStep）** 若已成功，本轮后续步仍可能已看到像素；若 Model 路径也失败，则仅依赖工具返回 JSON，视觉可能缺失。刷新后若 DB 未写入合成 USER，仅时间线缺图。
            </Callout>

            <Divider />

            <H2>两条路径的写入目标对比</H2>
            <div style={{ padding: '12px 16px', border: `1px solid ${theme.stroke.tertiary}`, borderRadius: 6 }}>
                <Table
                    headers={['路径', '写入目标', '可见范围', '触发时机']}
                    rows={[
                        ['Model 路径（prepareStep）', 'AI SDK 消息链（内存，不持久化）', '仅 LLM 本次请求可见', '每步开始前'],
                        ['DB 路径（onStepFinish）', 'DB Message 表（role=USER, parts 含 image）', '重载会话后 UI 可见', '每步结束后'],
                    ]}
                    striped
                />
            </div>
        </Stack>
    )
}
