import { Callout, Code, Divider, H1, H2, H3, Stack, Table, Text } from 'cursor/canvas'

export default function AgentImageArchitectureCanvas() {
    return (
        <Stack gap={24}>
            <H1>agent-image 技术架构</H1>

            <Callout tone="neutral" title="阅读说明">
                本画布由仓库内计划、需求文档与源码结构汇总而成，便于人类快速建立心智模型。
                <Text>
                    产品与验收的权威来源仍为仓库中的 Markdown（
                    <Code>docs/brainstorms/</Code>
                    、
                    <Code>docs/plans/</Code>
                    ）与源码；画布不替代版本化文档。
                </Text>
                <Text tone="secondary" size="small">
                    Cursor 只会编译本机
                    {' '}
                    <Code>~/.cursor/projects/…/canvases/</Code>
                    {' '}
                    下的
                    {' '}
                    <Code>.canvas.tsx</Code>
                    （见 Cursor
                    {' '}
                    <Code>canvas</Code>
                    {' '}
                    skill「Location」）。仓库内同名文件若存在，仅作 Git 归档；请以 IDE 实际打开的托管路径文件为准。
                </Text>
            </Callout>

            <H2>总览</H2>
            <Text>
                单机自用 Next.js App Router（R1：玩具级，无内置多租户/auth 前置）；多轮 Agent，偏向图像编排。Vercel AI SDK
                {' '}
                <Code>ToolLoopAgent</Code>
                ；LLM / 生图 / Search 多 Provider；SQLite + Prisma；无全局单一 API Key。
            </Text>

            <Divider />

            <H2>系统边界与信任域</H2>
            <Table
                headers={['层', '职责 / 不信任边界']}
                rows={[
                    ['浏览器', 'React 对话 UI、 Composer 选型、`useChat` 消费 SSE；不配直连厂商密钥'],
                    ['Next 服务端', 'Route Handler 校验、拼装 Agent、持久化 Message / Image meta、出站调用 LLM·工具链'],
                    ['外部 Provider', '各 Model 记录的 baseURL + 明文密钥（单机玩具）；按调用点出网'],
                    ['SQLite', '会话、消息 parts、选型、绑定、图像索引；字节在 storage 模块'],
                ]}
            />
            <Text tone="secondary" size="small">
                与人类对齐时优先盯住「谁在服务端持有秘密、谁写入 DB」这两点，可避免把客户端与路由职责混淆。
            </Text>

            <Divider />

            <H2>端到端代码流动（主路径）</H2>
            <Text tone="secondary" size="small">
                以下为一轮 POST
                {' '}
                <Code>/api/chat</Code>
                {' '}
                的语义步骤，锚点文件
                {' '}
                <Code>app/api/chat/route.ts</Code>
                {' '}
                的
                {' '}
                <Code>handleChatPost</Code>
                ；不涉及函数体细节。
            </Text>
            <Table
                headers={['步骤', '发生什么', '锚点（模块）']}
                rows={[
                    ['1', '解析 JSON，Zod 校验 body', '`lib/validation/chat-post-schema.ts`'],
                    ['2', '读本会话 LLM 选型；无选型 400', '`getSelection`、`getModel`（`lib/db/*`）'],
                    ['3', '构造 `LanguageModel` 与可选 `providerOptions`', '`buildLlmModel`、`computeLlmChatProviderOptions`'],
                    ['4', '组装本轮 UI 消息：若 body 带来 `messages` 则先同步入 DB；否则从 DB `listMessages` 回放', '`syncIncomingClientUserMessages` / `listMessages`'],
                    ['5', '按会话暴露工具 + Mustache system prompt', '`buildAvailableTools`、`buildSystemPrompt`'],
                    ['6', '决定 assistant 消息 id：`continuingAssistant` 时延续同 id，否则 `randomUUID`', '`handleChatPost` 内分枝'],
                    ['7', '`buildAgent`：steps 中空则普通；若有 image-fetch batch，则在 `prepareStep` 追加 vision user 模型消息', '`lib/ai/image-fetch-vision-injection.ts`'],
                    ['8', '每步结束：`appendStepToParts`、回填 tool-result、`upsertAssistantMessage`；可选写入 vision user 副本到 DB', '`lib/ai/step-to-parts.ts`、同名 route 回调'],
                    ['9', '对流返回 UI stream，`generateMessageId` 与持久化 assistant id 对齐', '`createAgentUIStreamResponse`（`ai`）'],
                ]}
            />
            <Callout tone="info" title="侧车：客户端门禁">
                UI 何时可发送 / 停止、与工具确认（R15）/中断（R19）的协同，概要见
                {' '}
                <Code>lib/chat-guard.ts</Code>
                {' '}
                与需求文档；主链仍为「进到 route 以后」如上表。
            </Callout>

            <Divider />

            <H2>目录（Canvas 内导航）</H2>
            <Table
                headers={['章节', '内容']}
                rows={[
                    ['系统边界', '浏览器 · 服务端 · Provider · SQLite'],
                    ['端到端流动', 'POST `/api/chat` 主链 nine-step'],
                    ['技术栈', 'Bun / Next 16 / React 19 / AI SDK 6 / Prisma SQLite'],
                    ['界面', '对话页、侧栏、设置（Model CRUD）'],
                    ['API', 'chat、conversations、models、bindings、images'],
                    ['Agent', 'buildAgent + tools + Mustache prompt + vision / parts'],
                    ['数据', 'Model、Conversation、Message、Selection、Image、SearchToolBinding'],
                    ['横切与演进', '校验 / chat-guard / plans'],
                ]}
            />

            <Divider />

            <H2>技术栈与根目录</H2>
            <Table
                headers={['区域', '职责']}
                rows={[
                    ['app/', 'App Router、Route Handlers'],
                    ['lib/', 'Agent、tools、db、validation、factories'],
                    ['generated/prisma', 'Client 输出'],
                    ['prisma/', 'schema 与迁移'],
                    ['tests/', 'Vitest'],
                    ['docs/plans/', 'CE 计划'],
                ]}
            />

            <H3>前端呈现</H3>
            <Text tone="secondary" size="small">
                Tailwind v4 + daisyUI 5。Streamdown + mermaid/math/cjk 插件。
            </Text>

            <Divider />

            <H2>主要页面</H2>
            <Table
                headers={['路径', '作用']}
                rows={[
                    [
                        'app/page.tsx',
                        '有最近会话则 redirect；无则占位引导（侧栏手动新建，不自动创建会话）',
                    ],
                    ['app/conversations/[id]/', 'ChatPage、Composer、用量条'],
                    ['app/settings/', 'Model CRUD、Search 绑定'],
                    ['layout + Sidebar', 'ConversationSidebarNav'],
                ]}
            />
            <Text tone="secondary" size="small">
                <Code>useChat</Code>
                {' '}
                对接
                {' '}
                <Code>createAgentUIStreamResponse</Code>
                ；流内 message id 与 DB assistant 对齐在 route 内处理。
            </Text>

            <Divider />

            <H2>HTTP API</H2>
            <Table
                headers={['Route', '作用']}
                rows={[
                    [
                        'app/api/chat/route.ts POST',
                        '校验、LLM selection、tools、ToolLoopAgent、UI stream；R15/R19 与客户端协同',
                    ],
                    ['app/api/conversations/', '会话 REST'],
                    ['app/api/models/', 'Model REST'],
                    ['app/api/bindings/', 'SearchTool → Model'],
                    ['app/api/images/[id]/', '读 storage 中图像 bytes'],
                ]}
            />

            <H3>图像分层</H3>
            <Text tone="secondary" size="small">
                <Code>Image</Code>
                表存元数据；
                {' '}
                <Code>lib/images/storage.ts</Code>
                {' '}
                存像素；
                {' '}
                <Code>GET /api/images/[id]</Code>
                。
            </Text>

            <H3>Chat POST 契约</H3>
            <Text tone="secondary" size="small">
                <Code>chat-post-schema</Code>
                。body 带
                {' '}
                <Code>messages</Code>
                {' '}
                则同步用户消息入 DB。Provider 选项：
                {' '}
                <Code>llm-chat-provider-options.ts</Code>
                。
            </Text>

            <Divider />

            <H2>Agent 运行时</H2>
            <Text>
                <Code>build-agent.ts</Code>
                → ToolLoopAgent。
                {' '}
                <Code>tool-registry buildAvailableTools</Code>
                ：rename、search、fetch、image-fetch、条件生图 primary/secondary。
            </Text>
            <Text>
                Vision：
                {' '}
                <Code>image-fetch-vision-injection.ts</Code>
                、
                {' '}
                <Code>vision-inject-xml.ts</Code>
                ；
                {' '}
                <Code>step-to-parts.ts</Code>
                {' '}
                写 Message parts。
            </Text>
            <Text tone="secondary" size="small">
                Prompt：
                {' '}
                <Code>system.mustache.txt</Code>
                +
                {' '}
                <Code>system-prompt.ts</Code>
                。
            </Text>

            <Divider />

            <H2>Prisma 模型</H2>
            <Table
                headers={['模型', '要点']}
                rows={[
                    ['Model', 'LLM | IMAGE | SEARCH'],
                    ['Conversation', 'messages / selections / images'],
                    ['Message', 'parts JSON；用量'],
                    ['ConversationModelSelection', '每会话每 role 至多一条'],
                    ['Image', '枚举来源；字节在 storage'],
                    ['SearchToolBinding', 'WEB_SEARCH / IMAGE_SEARCH'],
                ]}
            />

            <Divider />

            <H2>横切</H2>
            <Table
                headers={['主题', '路径']}
                rows={[
                    ['校验', 'lib/validation/*'],
                    ['对话门禁', 'lib/chat-guard.ts'],
                    ['SSRF', 'lib/tools/ssrf-guard.ts'],
                    ['Provider', 'llm- / image-provider-factory'],
                    ['测试', 'bun test'],
                ]}
            />

            <Divider />

            <H2>docs/plans（与仓库同步：共 13 份）</H2>
            <Text tone="secondary" size="small">
                列表来自
                {' '}
                <Code>docs/plans/</Code>
                {' '}
                目录扫描；若画布与目录不一致，以 Git 为准。
            </Text>
            <Table
                headers={['文件', '主题']}
                rows={[
                    ['2026-04-23-001-feat-chat-ui-shell-plan.md', 'Chat UI shell'],
                    ['2026-04-29-001-feat-chat-shell-m1-engineering-plan.md', 'M1 eng'],
                    ['2026-04-29-002-feat-agent-tools-m2-engineering-plan.md', 'M2 工具'],
                    ['2026-04-29-003-feat-image-gen-m3-engineering-plan.md', 'M3 生图'],
                    ['2026-04-30-001-feat-seedream-presets-baseurl-plan.md', 'Seedream'],
                    ['2026-04-30-002-feat-dashscope-wan-image-plan.md', 'WAN'],
                    ['2026-04-30-003-feat-conversation-sidebar-manage-plan.md', '侧栏会话'],
                    ['2026-04-30-004-feat-composer-model-modal-thinking-plan.md', 'Composer/thinking'],
                    ['2026-04-30-005-feat-multimodal-image-loop-plan.md', '多模态'],
                    ['2026-04-30-006-fix-image-ui-format-plan.md', '生图 UI 格式'],
                    ['2026-04-30-007-feat-batch-image-fetch-and-vision-injection-plan.md', 'batch vision'],
                    ['2026-05-01-001-refactor-system-prompt-mustache-plan.md', 'Mustache'],
                    ['2026-05-02-001-feat-ce-canvas-workflow-plan.md', 'CE Canvas'],
                ]}
            />

            <Divider />

            <H2>专题画布（技术决策与代码模型）</H2>
            <Table
                headers={['文件', '内容']}
                rows={[
                    ['AI运行时与聊天接口.canvas.tsx', 'ToolLoopAgent、prepareStep、runId、onStepFinish'],
                    ['消息与parts模型.canvas.tsx', 'parts 合同、patch、SSR 初始'],
                    ['工具注册与审批.canvas.tsx', 'registry、R15、fetch'],
                    ['模型工厂与会话选型.canvas.tsx', 'LLM/生图工厂、选型'],
                    ['维护者手册.canvas.tsx', '命令与权威阅读顺序'],
                ]}
            />

            <Divider />

            <H2>References</H2>
            <Table
                headers={['路径', '说明']}
                rows={[
                    ['AGENTS.md', '协作约定'],
                    ['docs/brainstorms/2026-04-23-agent-image-requirements.md', 'R 条'],
                    ['lib/tools/tool-registry.ts', '工具'],
                    ['app/api/chat/route.ts', 'chat'],
                    ['lib/images/storage.ts', '图像字节'],
                    ['lib/chat-guard.ts', '发送门禁'],
                    ['prisma/schema.prisma', '持久化 schema'],
                ]}
            />
        </Stack>
    )
}
