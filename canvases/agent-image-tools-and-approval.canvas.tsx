import { Callout, Code, Divider, H1, H2, Stack, Table, Text } from 'cursor/canvas'

export default function AgentImageToolsAndApprovalCanvas() {
    return (
        <Stack gap={20}>
            <H1>工具注册、搜索绑定与生图审批</H1>
            <Text tone="secondary" size="small">
                锚点：
                {' '}
                <Code>lib/tools/tool-registry.ts</Code>
                {' · 各 '}
                <Code>lib/tools/*.ts</Code>
                {' · '}
                <Code>ChatPage.tsx</Code>
                {' (useChat)'}
            </Text>

            <H2>buildAvailableTools 拼装规则</H2>
            <Table
                headers={['工具 id', '条件']}
                rows={[
                    ['conversation-rename', '始终注册'],
                    ['web-search', '存在 SearchToolBinding WEB_SEARCH 且 Model 存在'],
                    ['image-search', '存在 IMAGE_SEARCH 绑定且 Model 存在'],
                    ['web-fetch', '始终（SSR + `assertPublicHttpUrl`）'],
                    ['image-fetch', '始终（每会话；sources 上限 10）'],
                    ['image-generate-primary', '会话有 IMAGE_PRIMARY 且 model.capabilities 可解析为 ImageModelCapabilities'],
                    ['image-generate-secondary', '同上，IMAGE_SECONDARY'],
                ]}
            />
            <Text tone="secondary" size="small">
                绑定缺失时**不注册**对应搜索工具；符合 R3/R9「能力缺失由 Agent 文本告知」而非服务端硬拦用户输入。
            </Text>

            <Divider />

            <H2>R15：needsApproval + 客户端续跑</H2>
            <Table
                headers={['层', '实现要点']}
                rows={[
                    ['工具定义', '`createImageGenerateTool` 设 `needsApproval: true`；execute 内才调真实生图', '`image-generate.ts`'],
                    [
                        'UI',
                        '`useChat` + `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`',
                        '批准后自动再发一轮请求',
                    ],
                    [
                        '用户操作',
                        '`addToolApprovalResponse({ id, approved: true|false })`',
                        '拒绝语义进入 tool-result（execution-denied 等），由 patch 写回 parts',
                    ],
                ]}
            />
            <Callout tone="neutral" title="与需求对齐">
                产品闸在 SDK 协议 + UI，不靠「仅写 system prompt 不许画」扛 R15。
            </Callout>

            <Divider />

            <H2>web-fetch / image-fetch 与安全</H2>
            <Table
                headers={['工具', '约束']}
                rows={[
                    ['web-fetch', '`assertPublicHttpUrl`、30s 超时、与 abortSignal 合并、正文截断 50KB'],
                    ['image-fetch', '同上 URL 校验；可拉 URL 或引用已有 imageId；落盘 + Image 表；多 item 结果'],
                ]}
            />

            <Divider />

            <H2>conversation-rename</H2>
            <Text tone="secondary" size="small">
                始终暴露；execute 内改 Prisma
                {' '}
                <Code>Conversation.title</Code>
                。具体 schema 见
                {' '}
                <Code>conversation-rename.ts</Code>
                。
            </Text>

            <Divider />

            <H2>相关画布</H2>
            <Table
                headers={['文件', '内容']}
                rows={[
                    ['消息与parts模型.canvas.tsx', 'tool part 状态与 patch'],
                    ['模型工厂与会话选型.canvas.tsx', '生图 execute 调用的工厂'],
                ]}
            />
        </Stack>
    )
}
