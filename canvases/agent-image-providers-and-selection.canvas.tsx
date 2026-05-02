import { Callout, Code, Divider, H1, H2, Stack, Table, Text } from 'cursor/canvas'

export default function AgentImageProvidersAndSelectionCanvas() {
    return (
        <Stack gap={20}>
            <H1>Provider 工厂与会话级选型</H1>
            <Text tone="secondary" size="small">
                锚点：
                {' '}
                <Code>lib/llm-provider-factory.ts</Code>
                {' · '}
                <Code>lib/image-provider-factory.ts</Code>
                {' · '}
                <Code>lib/db/selections.ts</Code>
                {' · Prisma '}
                <Code>ConversationModelSelection</Code>
            </Text>

            <H2>LLM：buildLlmModel</H2>
            <Table
                headers={['providerType', 'AI SDK 构造']}
                rows={[
                    ['OPENAI', '`createOpenAI({ apiKey }).(model.name)`'],
                    ['OPENAI_COMPATIBLE', '`createOpenAICompatible` + baseURL + 可选 extraHeaders'],
                    ['ALIBABA', '`createAlibaba` + 可选 baseURL / headers'],
                ]}
            />
            <Text tone="secondary" size="small">
                其它 providerType 在工厂内抛错；设置页与校验应保证 LLM 记录落在上述三类。
            </Text>

            <Divider />

            <H2>会话选型：SelectionRole</H2>
            <Table
                headers={['role', '存什么', '消费方']}
                rows={[
                    ['LLM', 'modelId + 可选 params（如 thinkingEnabled）', 'chat route、Composer、`computeLlmChatProviderOptions`'],
                    ['IMAGE_PRIMARY', 'modelId + params.size（能力校验后写入）', 'tool-registry 暴露主生图工具、表单'],
                    ['IMAGE_SECONDARY', '同上', '次生图工具'],
                ]}
            />
            <Callout tone="info" title="唯一约束">
                Prisma
                {' '}
                <Code>@@unique([conversationId, role])</Code>
                ：每个会话每个 role 至多一条选型记录。
            </Callout>

            <Divider />

            <H2>生图：executeImageGeneration</H2>
            <Table
                headers={['providerType', '行为概要']}
                rows={[
                    [
                        'VOLCENGINE_SEEDREAM',
                        'POST JSON（model/prompt/size）；默认或可配置 baseURL；下载返回 URL 像素；`createImage` GENERATED + storage',
                    ],
                    [
                        'DASHSCOPE_WAN_IMAGE',
                        '按 `mapSizeToDashscopeParameter` 映射 size；调百炼兼容 HTTP；同样落盘',
                    ],
                ]}
            />
            <Text tone="secondary" size="small">
                工厂文件内含超时与
                {' '}
                <Code>abortSignal</Code>
                组合逻辑；与 R19 中断一致。
            </Text>

            <Divider />

            <H2>capabilities JSON</H2>
            <Text>
                LLM / IMAGE 的设置页把厂商差异塞进
                {' '}
                <Code>Model.capabilities</Code>
                。生图侧
                {' '}
                <Code>ImageModelCapabilities</Code>
                （Zod）驱动：支持尺寸列表、reference 张数等；工具 schema 与「调用前 UI 阻塞」可共同依赖这些元数据（见需求 R4/R5）。
            </Text>

            <Divider />

            <H2>SearchToolBinding</H2>
            <Text tone="secondary" size="small">
                <Code>SearchTool</Code>
                枚举 WEB_SEARCH / IMAGE_SEARCH；各 tool 至多绑定一条 Model（Brave 密钥在记录里，R17 禁止 env fallback）。
            </Text>

            <Divider />

            <H2>相关画布</H2>
            <Table
                headers={['文件', '内容']}
                rows={[
                    ['AI运行时与聊天接口.canvas.tsx', '选型如何进入每轮 chat'],
                    ['工具注册与审批.canvas.tsx', '选型如何决定暴露哪些工具'],
                ]}
            />
        </Stack>
    )
}
