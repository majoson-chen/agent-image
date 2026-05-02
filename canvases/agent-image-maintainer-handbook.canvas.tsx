import { Callout, Code, Divider, H1, H2, H3, Stack, Table, Text } from 'cursor/canvas'

export default function AgentImageMaintainerHandbookCanvas() {
    return (
        <Stack gap={22}>
            <H1>agent-image 维护者手册</H1>

            <Callout tone="neutral" title="这张画布解决什么问题">
                面向在 Agent 主导开发后接手代码的人类：用可导航的概要降低「找不到入口、不知道规则写在哪」的成本。
                <Text tone="secondary" size="small">
                    权威来源顺序建议：
                    {' '}
                    <Code>docs/brainstorms/2026-04-23-agent-image-requirements.md</Code>
                    （R 条）
                    {' '}
                    →
                    {' '}
                    <Code>AGENTS.md</Code>
                    {' '}
                    → 具体实现源码 → 计划文档（可能滞后）。画布只作导读，修改行为前务必打开对应文件核对。
                </Text>
            </Callout>

            <H2>日常命令</H2>
            <Table
                headers={['目的', '命令']}
                rows={[
                    ['安装依赖', '`bun install`'],
                    ['本地开发', '`bun dev`'],
                    ['单元 / 集成测', '`bun test`'],
                    ['Lint', '`bun run lint` 或 `bun run lint:fix`'],
                    ['构建', '`bun run build`'],
                    ['Prisma 迁移开发', '`bun --bun run prisma migrate dev`（以 AGENTS.md 为准）'],
                    ['生成 Client', '`prisma generate`'],
                ]}
            />
            <Text tone="secondary" size="small">
                默认 SQLite URL 未设置时为
                {' '}
                <Code>file:./data.db</Code>
                （仓库根相对路径，见
                {' '}
                <Code>prisma.config.ts</Code>
                /
                {' '}
                <Code>lib/prisma.ts</Code>
                ）。
            </Text>

            <Divider />

            <H2>文档地图（从哪读起）</H2>
            <Table
                headers={['材料', '用途']}
                rows={[
                    ['requirements 需求', '产品边界、R1–R19、F1–F3；争论「该不该这样」时以它为底线'],
                    ['agent-playbook', '推荐性 Agent 工作流措辞，与 R8–R12、R14–R19 对照'],
                    ['AGENTS.md', '别名、Next+Skills、TDD 纪律、设计 token 约束'],
                    ['docs/design-language.md', 'daisyUI 语义色与 UI 约束'],
                    ['docs/plans/*.md', '历史工程决策与序列图；实现可能已偏离，需对照源码'],
                    ['专题 · AI 运行时', '`AI运行时与聊天接口.canvas.tsx`：ToolLoopAgent、prepareStep、runId'],
                    ['专题 · parts', '`消息与parts模型.canvas.tsx`：appendStepToParts、DB 同步'],
                    ['专题 · 工具与审批', '`工具注册与审批.canvas.tsx`：registry、R15、fetch'],
                    ['专题 · Provider 与选型', '`模型工厂与会话选型.canvas.tsx`：LLM/生图工厂、Selection'],
                    ['全景 · 架构', '`架构总览.canvas.tsx`：边界与九步主链'],
                ]}
            />

            <Divider />

            <H2>交叉验证：需求 ↔ 代码（抽样锚点）</H2>
            <Text tone="secondary" size="small">
                下列行在编写时已对照仓库源码与 requirements；你若升级实现，请以源码为准并回头改画布。
            </Text>
            <Table
                headers={['需求要点', '实现用锚点']}
                rows={[
                    ['R3：至少选 LLM 才能发', '`lib/chat-guard.ts` + `ChatPage` 组合；服务端无 LLM selection 时 400 见 chat route'],
                    ['R9：无主生图则不生图工具', '`lib/tools/tool-registry.ts` 中 `IMAGE_PRIMARY` / `IMAGE_SECONDARY` 分支'],
                    ['R15：生图先确认', 'AI SDK 工具需 `needsApproval`；客户端 `addToolApprovalResponse` / `useChat` 配置'],
                    ['R17：search 绑定、无 env fallback', '`SearchToolBinding` + `buildAvailableTools`；Brave 走 Model 记录'],
                    ['R19：停止 = abort', '`createAgentUIStreamResponse({ abortSignal: req.signal })`；`useChat` 的 `stop`'],
                    ['R13 已废弃 task_complete', '需求文内明示；工具列表中不应再出现该工具'],
                ]}
            />

            <Divider />

            <H2>工具名与暴露条件（与 tool-registry 一致）</H2>
            <Table
                headers={['注册名', '何时出现']}
                rows={[
                    ['conversation-rename', '始终'],
                    ['web-search', '存在 WEB_SEARCH 绑定且 Model 可解析'],
                    ['image-search', '存在 IMAGE_SEARCH 绑定且 Model 可解析'],
                    ['web-fetch', '始终'],
                    ['image-fetch', '始终'],
                    ['image-generate-primary', '会话已选主生图且 capabilities 可用'],
                    ['image-generate-secondary', '会话已选次生图且 capabilities 可用'],
                ]}
            />

            <Divider />

            <H2>计划文档 vs 实现：如何避免被旧计划误导</H2>
            <Callout tone="warning" title="常见漂移">
                <Text>
                    计划里的 mermaid、伪代码是「当时的方向」，不是 CI 契约。可信核实方式：在
                    {' '}
                    <Code>app/</Code>
                    、
                    {' '}
                    <Code>lib/</Code>
                    、
                    {' '}
                    <Code>tests/</Code>
                    {' '}
                    里搜同名符号（例如
                    {' '}
                    <Code>handleChatPost</Code>
                    、
                    {' '}
                    <Code>buildAvailableTools</Code>
                    ）。
                </Text>
                <Text tone="secondary" size="small">
                    本轮扫描曾发现：旧版架构画布引用了仓库中不存在的
                    {' '}
                    <Code>2026-05-02-003-*.md</Code>
                    ，已修正为与
                    {' '}
                    <Code>docs/plans/</Code>
                    {' '}
                    实际文件数一致。
                </Text>
            </Callout>
            <H3>Prisma 注释里的 M1/M2/M3</H3>
            <Text tone="secondary" size="small">
                <Code>schema.prisma</Code>
                {' '}
                仍保留「M1 仅 LLM」等历史注释，功能已合并演进；读 schema 时以当前字段与枚举为准，不要反推「还在 M1」。
            </Text>

            <Divider />

            <H2>改动前的最短检查单</H2>
            <Table
                headers={['话题', '动作']}
                rows={[
                    ['Next.js 行为不确定', '读 `.agents/skills/next-best-practices` + 本仓 `node_modules/next/dist/docs/` 对应页'],
                    ['AI SDK / 工具协议', '读 `.agents/skills/ai-sdk/SKILL.md`'],
                    ['涉及可验证行为', '先写失败测试（AGENTS.md TDD 默认）'],
                    ['样式', 'daisyUI 语义类；条件 class 用 `cn()`'],
                    ['新 import', '遵守 `@/*`、`@lib/*`、`~` 别名（见 AGENTS.md）'],
                ]}
            />

            <Divider />

            <H2>Canvas 文件放哪</H2>
            <Text>
                文件名可使用中文（UTF-8），例如本套专题画布；需与托管目录、Git 备份两处同步时保持同名。
            </Text>
            <Text>
                Cursor 编译托管目录为
                {' '}
                <Code>~/.cursor/projects/…/canvases/*.canvas.tsx</Code>
                。仓库内
                {' '}
                <Code>canvases/</Code>
                {' '}
                可用于 Git 备份；若两处都有文件，以 IDE 打开的托管路径为准，并手动保持与仓库同步（当前
                {' '}
                <Code>package.json</Code>
                {' '}
                无自动 sync 脚本）。
            </Text>

            <Divider />

            <H2>快速路径索引</H2>
            <Table
                headers={['我想……', '打开']}
                rows={[
                    ['看一轮对话如何跑完', '`app/api/chat/route.ts` → `lib/ai/build-agent.ts`'],
                    ['改工具行为', '`lib/tools/*`、`lib/tools/tool-registry.ts`'],
                    ['改持久化', '`prisma/schema.prisma`、`lib/db/*`'],
                    ['改对话 UI', '`app/conversations/[id]/ChatPage.tsx`'],
                    ['改模型设置', '`app/settings/*`、`app/api/models/*`'],
                    ['理解 R15/R19 客户端面', '`ChatPage.tsx` 中 `useChat`、submit 按钮状态'],
                ]}
            />
        </Stack>
    )
}
