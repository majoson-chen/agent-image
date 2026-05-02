import { Callout, Code, Divider, H1, H2, Stack, Table, Text } from 'cursor/canvas'

export default function AgentImageMessagesAndPartsCanvas() {
    return (
        <Stack gap={20}>
            <H1>消息与 parts：DB、UI、流三端对齐</H1>
            <Text tone="secondary" size="small">
                锚点：
                {' '}
                <Code>lib/db/messages.ts</Code>
                {' · '}
                <Code>lib/ai/step-to-parts.ts</Code>
                {' · '}
                <Code>lib/conversations/initial-messages.ts</Code>
                {' · Prisma '}
                <Code>Message.parts</Code>
            </Text>

            <H2>Prisma 层</H2>
            <Table
                headers={['字段', '含义']}
                rows={[
                    ['content', '兼容层：从 parts 里所有 text part 拼接；旧 M1 消息可仅有 content、parts=null'],
                    ['parts', 'Json：AI SDK UIMessage 的 parts 数组；assistant 流式多段与工具卡存在此'],
                    ['usage* / modelIdAtTime', 'assistant 行：累计 token 与当时 LLM id'],
                ]}
            />

            <Divider />

            <H2>服务端写 user 消息两条路径</H2>
            <Table
                headers={['路径', '函数', '用途']}
                rows={[
                    ['客户端随 POST 带上 messages', '`syncIncomingClientUserMessages` → `upsertUserMessageParts`', '仅处理 role=user；校验 id 不跨会话'],
                    ['image-fetch 视觉镜像', '`createUserMessageWithParts`', '插入纯服务端生成的 user 行（XML 引导文本 + file parts）'],
                ]}
            />

            <Divider />

            <H2>appendStepToParts 合同</H2>
            <Text>
                输入为 AI SDK 的
                {' '}
                <Code>StepResult</Code>
                ，输出为面向 UI 的 parts 数组。**每个 step 前**插入
                {' '}
                <Code>{'{ type: \'step-start\' }'}</Code>
                {' '}
                作为分段标记。
            </Text>
            <Table
                headers={['SDK content', 'UI part']}
                rows={[
                    ['text', '{ type: \'text\', text }'],
                    ['tool-call + tool-result', '{ type: `tool-${name}`, state: \'output-available\', toolCallId, input, output }'],
                    ['tool-call + tool-error', 'state: \'output-error\', errorText'],
                    ['tool-call 尚无结果', 'state: \'input-available\'（审批前或跨步等待）'],
                ]}
            />
            <Text tone="secondary" size="small">
                reasoning、source 等其它 content 类型当前**忽略**不写进 parts。
            </Text>

            <Divider />

            <H2>patchToolResultsFromResponseMessages</H2>
            <Callout tone="neutral" title="何时需要">
                生图等工具带
                {' '}
                <Code>needsApproval</Code>
                时，首轮可能只在 parts 里落到
                {' '}
                <Code>input-available</Code>
                ；用户批准后下一轮 POST 里，`step.response.messages` 中 role=tool 的
                {' '}
                <Code>tool-result</Code>
                {' '}
                才携带 execution-denied / json / error；本函数把这些结果**回写到**仍处在 input-available 的同名 toolCallId part上。
            </Callout>

            <Divider />

            <H2>SSR 初始消息</H2>
            <Text>
                <Code>mapDbMessagesToInitialMessages</Code>
                ：若
                {' '}
                <Code>parts</Code>
                {' '}
                已是数组则用；**否则**
                {' '}
                <Code>[{'{ type: \'text\', text: content }'}]</Code>
                。
                与 chat route 里「DB 回放」分支同样思路，保证旧数据可读。
            </Text>

            <Divider />

            <H2>相关画布</H2>
            <Table
                headers={['文件', '内容']}
                rows={[
                    ['AI运行时与聊天接口.canvas.tsx', 'onStepFinish 如何驱动上述 parts 写入'],
                    ['工具注册与审批.canvas.tsx', '工具 part 状态机与 R15'],
                ]}
            />
        </Stack>
    )
}
