import {
    Card,
    CardBody,
    CardHeader,
    Divider,
    Grid,
    H1,
    H2,
    Pill,
    Row,
    Stack,
    Table,
    Text,
    useHostTheme,
} from 'cursor/canvas'

export default function ArchitectureOverview() {
    const theme = useHostTheme()

    return (
        <Stack gap={24} style={{ padding: 24 }}>
            <Stack gap={6}>
                <H1>agent-image · 架构总览</H1>
                <Text tone="secondary">
                    Next.js App Router 应用，提供多轮对话 Agent，任务偏向图像生成与编排，支持多厂商 LLM 与生图 Provider，配置与数据落 SQLite。
                </Text>
            </Stack>

            <Divider />

            <H2>目录层次</H2>
            <Stack gap={6}>
                <div style={{ padding: '10px 16px', background: theme.fill.secondary, borderRadius: 6, border: `1px solid ${theme.stroke.tertiary}` }}>
                    <Row gap={10} align="center">
                        <Text weight="semibold">`app/`</Text>
                        <Text tone="secondary" size="small">UI 层</Text>
                    </Row>
                    <Text size="small" tone="secondary">
                        Next.js 页面与 React 组件、Route Handler。`conversations/[id]/` · `settings/` · `api/`
                    </Text>
                </div>
                <div style={{ padding: '10px 16px', background: theme.fill.tertiary, borderRadius: 6, border: `1px solid ${theme.stroke.tertiary}` }}>
                    <Row gap={10} align="center">
                        <Text weight="semibold">`lib/`</Text>
                        <Text tone="secondary" size="small">业务逻辑层</Text>
                    </Row>
                    <Text size="small" tone="secondary">
                        AI 运行时、工具系统、Provider 工厂、数据访问函数、校验 schema。`ai/` · `tools/` · `db/` · `image/` · `validation/`
                    </Text>
                </div>
                <div style={{ padding: '10px 16px', borderRadius: 6, border: `1px solid ${theme.stroke.tertiary}` }}>
                    <Row gap={10} align="center">
                        <Text weight="semibold">`prisma/`</Text>
                        <Text tone="secondary" size="small">数据层</Text>
                    </Row>
                    <Text size="small" tone="secondary">
                        SQLite + Prisma schema + 迁移文件。客户端生成到 `generated/prisma/`，运行时单例在 `lib/prisma.ts`。
                    </Text>
                </div>
            </Stack>

            <Divider />

            <H2>核心模块</H2>
            <Grid columns={2} gap={12}>
                <Card>
                    <CardHeader trailing={<Pill size="sm">lib/ai/</Pill>}>AI 运行时</CardHeader>
                    <CardBody>
                        <Stack gap={4}>
                            <Text size="small">Agent 构建、system prompt 生成、step 结果转换、视觉上下文注入、用户附图 URL 展开（进模型前）。</Text>
                            <Text size="small" tone="secondary">`build-agent.ts` · `system-prompt.ts` · `step-to-parts.ts` · `image-fetch-vision-injection.ts` · `user-attach-xml.ts` · `normalize-user-image-parts.ts`</Text>
                        </Stack>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader trailing={<Pill size="sm">lib/tools/</Pill>}>工具系统</CardHeader>
                    <CardBody>
                        <Stack gap={4}>
                            <Text size="small">动态工具注册，按会话选型和全局绑定决定 Agent 持有的工具集；**生图工具**经 **`lib/tools/image-generate.ts`** 按 Catalog **`createImageGenerateTool`** 派发。</Text>
                            <Text size="small" tone="secondary">`tool-registry.ts`（调用 Catalog 钩子）· conversation-rename · web-fetch · image-fetch · web-search · image-search · image-generate</Text>
                        </Stack>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader trailing={<Pill size="sm">lib/</Pill>}>Provider 工厂</CardHeader>
                    <CardBody>
                        <Stack gap={4}>
                            <Text size="small">将 DB `Model` 转为 `LanguageModel`（**`build-llm-from-model`** → Catalog **`buildLanguageModel`**）与生图工具（**`image-generate.ts`** → Catalog **`createImageGenerateTool`**）；HTTP 在 Register 侧。</Text>
                            <Text size="small" tone="secondary">`lib/providers/runtime/build-llm-from-model.ts` · `lib/tools/image-generate.ts` · `lib/llm-chat-provider-options.ts`</Text>
                        </Stack>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader trailing={<Pill size="sm">lib/db/</Pill>}>数据访问</CardHeader>
                    <CardBody>
                        <Stack gap={4}>
                            <Text size="small">Prisma 操作的封装函数层，每个业务实体独立一个文件。</Text>
                            <Text size="small" tone="secondary">conversations · messages · models · images · selections · search-tool-bindings</Text>
                        </Stack>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader trailing={<Pill size="sm">app/api/</Pill>}>Route Handler</CardHeader>
                    <CardBody>
                        <Stack gap={4}>
                            <Text size="small">`chat/route.ts` 是核心对话接口；`models/` · **`register-metadata/`**（只读 Register 目录）· `conversations/` · `images/`（GET 读图、POST 用户上传）· `bindings/` 等。</Text>
                        </Stack>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader trailing={<Pill size="sm">app/</Pill>}>UI 页面</CardHeader>
                    <CardBody>
                        <Stack gap={4}>
                            <Text size="small">`conversations/[id]/`：ChatPage、Composer、ComposerAttachments（用户附图）、ContextUsageBar</Text>
                            <Text size="small">
                                `settings/`：模型管理；打开表单时拉取 `GET /api/register-metadata`，**name**（展示）与 API **modelId**（LLM）/ **requestModel**（生图）分离。
                            </Text>
                            <Text size="small">`Sidebar.tsx`：会话列表与导航</Text>
                        </Stack>
                    </CardBody>
                </Card>
            </Grid>

            <Divider />

            <H2>对话请求生命周期</H2>
            <Text tone="secondary" size="small">POST /api/chat 从进入到 Assistant 消息写库的完整路径。</Text>
            <Table
                headers={['#', '位置', '操作']}
                rows={[
                    ['1', '前端 useChat', '提交消息 POST /api/chat，携带 conversationId 与 messages；可先经 Composer POST /api/images 落库 USER_UPLOAD，再在 user parts 中带 `/api/images/{id}` 的 file part'],
                    ['2', 'app/api/chat/route.ts', '校验请求体（chatPostBodySchema），读取 LLM ConversationModelSelection'],
                    ['3', 'lib/tools/tool-registry.ts', 'buildAvailableTools()：按 selection + binding 组装 ToolSet + descriptors；生图经 Catalog `createImageGenerateTool`'],
                    ['4', 'lib/ai/system-prompt.ts', 'buildSystemPrompt(descriptors)：生成含工具声明的 system prompt'],
                    ['5', 'lib/ai/build-agent.ts', 'buildAgent()：创建 ToolLoopAgent，注入 model / tools / instructions'],
                    ['6', 'AI SDK ToolLoopAgent', '多步循环推理，每步结束触发 onStepFinish'],
                    ['7', 'onStepFinish 回调', 'appendStepToParts → patchToolResultsFromResponseMessages → upsertAssistantMessage'],
                    ['8', 'prepareStep 钩子', '检测上步 image-fetch 结果 → buildVisionUserModelMessage → 注入 vision 消息'],
                    ['9', 'createAgentUIStreamResponse', '将 Agent 输出 stream 返回前端，useChat 实时渲染 parts'],
                ]}
                columnAlign={['center', 'left', 'left']}
                striped
            />

            <Divider />

            <H2>画布导航</H2>
            <Table
                headers={['画布', '覆盖内容']}
                rows={[
                    ['数据模型', 'Prisma · Model 使用 registerId + Json config · Register 目录 · Settings 与表字段映射'],
                    ['Provider 工厂', 'Catalog：`buildLanguageModel` · `createImageGenerateTool` · `computeLlmChatProviderOptions(model)` · Presets'],
                    ['工具系统', 'buildAvailableTools() · 三类暴露条件 · 各工具入参出参 · SSRF 防护'],
                    ['Agent 运行时与消息 Parts', 'handleChatPost() 主流程 · ToolLoopAgent · parts 结构 · continuation · usage'],
                    ['视觉上下文注入', 'prepareStep 路径 · onStepFinish DB 路径 · 两个去重 Set · 失败处理'],
                ]}
            />
        </Stack>
    )
}
