import { Callout, Code, Divider, H1, H2, Stack, Table, Text } from 'cursor/canvas'

export default function MaintainerHandbookCanvas() {
    return (
        <Stack gap={20}>
            <H1>维护者手册</H1>
            <Text tone="secondary" size="small">
                本套 Canvas 是给人看的说明；需要抠实现时直接打开源码。默认数据库文件在仓库根目录
                {' '}
                <Code>data.db</Code>
                （未配置环境变量时）。
            </Text>

            <H2>常用命令</H2>
            <Table
                headers={['用途', '命令']}
                rows={[
                    ['安装', '`bun install`'],
                    ['开发', '`bun dev`'],
                    ['测试', '`bun test`'],
                    ['检查代码', '`bun run lint`'],
                    ['数据库迁移', '`bun --bun run prisma migrate dev`'],
                ]}
            />

            <Divider />

            <H2>这套 Canvas 怎么读</H2>
            <Table
                headers={['画布', '适合了解什么']} 
                rows={[
                    ['架构总览', '整体分层、聊天主链路、目录与数据大致放哪'],
                    ['AI运行时与聊天接口', '一次问答在服务端怎么跑起来：谁调模型、谁持久化、中断与「接着上次说」'],
                    ['消息与 parts 模型', '聊天记录在数据库里长什么样、和界面上的气泡怎么对应'],
                    ['工具注册与审批', '有哪些能力、什么时候会出现、生图为什么要先点确认'],
                    ['模型工厂与会话选型', '对话里选的 LLM / 主次生图怎么接到具体厂商 API'],
                ]}
            />

            <Divider />

            <H2>产品行为（摘要）</H2>
            <Text>
                单机自用： keys 存在本地库里，浏览器拿不到。每条对话要选人用的语言模型；主／次生图可以不选，不选就没有对应生图能力。
                生图前必须在时间线里点确认或拒绝；拒绝就当作这次调用没执行。搜索要先在设置里绑好密钥对应的模型。
                用户随时可以停：相当于请求被取消，在跑的工具会失败。
            </Text>

            <Divider />

            <H2>从问题找到代码（按需）</H2>
            <Table
                headers={['你想改……', '从哪儿看起']}
                rows={[
                    ['整轮对话逻辑', 'app/api/chat'],
                    ['工具具体行为', 'lib/tools'],
                    ['存库与消息', 'lib/db、prisma/schema.prisma'],
                    ['对话页界面', 'app/conversations'],
                    ['模型与设置页', 'app/settings'],
                ]}
            />

            <Divider />

            <H2>文件放哪</H2>
            <Text tone="secondary" size="small">
                Cursor 读的是本机
                {' '}
                <Code>~/.cursor/projects/…/canvases/</Code>
                ；仓库里
                {' '}
                <Code>canvases/</Code>
                {' '}
                方便备份，改完记得两边对齐。可用中文文件名。
            </Text>

            <Callout tone="neutral" title="和自动化协作约定">
                仓库里的
                {' '}
                <Code>AGENTS.md</Code>
                {' '}
                主要给 AI 协作用；你不读也没关系。
            </Callout>
        </Stack>
    )
}
