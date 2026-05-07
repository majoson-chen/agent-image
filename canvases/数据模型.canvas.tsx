import {
    Card,
    CardBody,
    CardHeader,
    Divider,
    Grid,
    H1,
    H2,
    Pill,
    Stack,
    Table,
    Text,
} from 'cursor/canvas'

export default function DataModel() {
    return (
        <Stack gap={24} style={{ padding: 24 }}>
            <Stack gap={6}>
                <H1>数据模型</H1>
                <Text tone="secondary">
                    Schema 定义在 `prisma/schema.prisma`。Prisma 客户端生成到 `generated/prisma/`，运行时通过 `lib/prisma.ts` 的单例访问。数据库为 SQLite，默认路径为仓库根目录的 `data.db`（已 .gitignore）。
                </Text>
            </Stack>

            <Divider />

            <H2>表结构</H2>

            <Card collapsible defaultOpen>
                <CardHeader trailing={<Pill size="sm" tone="info">全局</Pill>}>Model · 模型配置</CardHeader>
                <CardBody>
                    <Stack gap={8}>
                        <Text size="small">
                            全局模型配置表，存储 LLM、图像、搜索三类连接信息。运行时以 **`registerId`** 解析 **`lib/providers/registry.ts` Catalog 行**（LLM `buildLanguageModel` / 可选 `computeLlmChatProviderOptions`，IMAGE `createImageGenerateTool`）；**Kernel 不持有厂商 SKU 枚举名单，仅以 Catalog 为真源**。`config` 为 JSON，经 **`parseModelConfig(registerId, config)`** 与各 Register 的 Zod schema 对齐。详见 **`docs/guides/register-system.md`**。删除 Model 时，关联 `ConversationModelSelection` 与 `SearchToolBinding` 级联删除；历史 `Message` / `Image` 外键 SetNull。**`name` 仅列表展示**，LLM / 图像实际请求模型名分别在 `config.modelId` / **`config.requestModel`**。
                        </Text>
                        <Table
                            headers={['字段', '类型', '说明']}
                            rows={[
                                ['id', 'String cuid', '主键'],
                                ['type', 'ModelType', 'LLM / IMAGE / SEARCH'],
                                ['registerId', 'String', 'Catalog SKU；元数据列表来自 Register 目录 / `GET /api/register-metadata`'],
                                ['name', 'String', '用户可读标签；不参与下游 HTTP body 的 model 字段'],
                                ['config', 'Json', 'Register 专有：含 apiKey、modelId/requestModel、baseURL?、capabilities? 等'],
                                ['createdAt / updatedAt', 'DateTime', '时间戳'],
                            ]}
                            striped
                        />
                    </Stack>
                </CardBody>
            </Card>

            <Card collapsible defaultOpen>
                <CardHeader trailing={<Pill size="sm">会话</Pill>}>Conversation · 会话</CardHeader>
                <CardBody>
                    <Stack gap={8}>
                        <Text size="small">会话是消息、选型、图像的聚合根。删除会话时，三者全部级联删除。</Text>
                        <Table
                            headers={['字段', '类型', '说明']}
                            rows={[
                                ['id', 'String cuid', '主键'],
                                ['title', 'String?', '由 `conversation-rename` 工具写入；新建会话初始为 null'],
                                ['createdAt / updatedAt', 'DateTime', '时间戳'],
                            ]}
                            striped
                        />
                    </Stack>
                </CardBody>
            </Card>

            <Card collapsible defaultOpen>
                <CardHeader trailing={<Pill size="sm">消息</Pill>}>Message · 消息</CardHeader>
                <CardBody>
                    <Stack gap={8}>
                        <Text size="small">
                            与 SPEC 对齐：单字段 **`payload`（Json）** 承载 UIMessage 子集——`role`（user | assistant | system）、`parts` 数组、`metadata`（含 `usage`、`modelIdAtTime` 等）。表上冗余 **`role`（MessageRole）** 便于查询与粗筛；时间线与模型输入以 **`parseMessagePayload` → parts** 为准。用户多模态消息的 file part 持久化为 `/api/images/
                            {id}
                            ` 引用，不在库内放大体积 base64。
                        </Text>
                        <Table
                            headers={['字段', '类型', '说明']}
                            rows={[
                                ['id', 'String', '主键；user 与客户端 message id 对齐；assistant 首轮为 chat route 生成的 runId，审批续写复用同一 id'],
                                ['conversationId', 'String', 'FK → Conversation（onDelete: Cascade）'],
                                ['role', 'MessageRole', 'USER / ASSISTANT / SYSTEM，与 payload.role 同步'],
                                ['payload', 'Json', '{ role, parts, metadata? }；用量仅在 assistant 的 metadata.usage'],
                                ['createdAt', 'DateTime', '创建时间；排序用'],
                            ]}
                            striped
                        />
                    </Stack>
                </CardBody>
            </Card>

            <Card collapsible defaultOpen>
                <CardHeader trailing={<Pill size="sm" tone="info">核心</Pill>}>ConversationModelSelection · 会话选型</CardHeader>
                <CardBody>
                    <Stack gap={8}>
                        <Text size="small">
                            每个会话最多持有三条选型记录，由 `(conversationId, role)` 唯一约束。`role` 的三个值驱动不同的运行时行为：`LLM` 决定推理用的语言模型；`IMAGE_PRIMARY` / `IMAGE_SECONDARY` 决定工具注册时是否分别暴露 `image-generate-primary` / `image-generate-secondary` 工具。删除关联 Model 时选型一并级联删除。
                        </Text>
                        <Table
                            headers={['字段', '类型', '说明']}
                            rows={[
                                ['id', 'String cuid', '主键'],
                                ['conversationId', 'String', 'FK → Conversation（onDelete: Cascade）'],
                                ['role', 'SelectionRole', 'LLM / IMAGE_PRIMARY / IMAGE_SECONDARY'],
                                ['modelId', 'String', 'FK → Model（onDelete: Cascade）'],
                                ['params', 'Json?', '图像选型存 { size: "2048x2048" }；LLM 选型为 null'],
                            ]}
                            striped
                        />
                    </Stack>
                </CardBody>
            </Card>

            <Card collapsible defaultOpen>
                <CardHeader trailing={<Pill size="sm">图像</Pill>}>Image · 图像记录</CardHeader>
                <CardBody>
                    <Stack gap={8}>
                        <Text size="small">
                            二进制文件落盘在 `data/images/` 目录（由 `lib/images/storage.ts` 管理），此表仅存元数据。`id` 同时用作 `/api/images/[id]` GET 参数与 POST 上传响应中的 `imageId`。`USER_UPLOAD` 由对话页 `POST /api/images`（`app/api/images/route.ts`）在完成 MIME / 大小校验并绑定 `conversationId` 后写入；前端在 user 消息 file part 中长期引用 `/api/images/[id]`，而非把 base64 当真源存入消息 JSON。
                        </Text>
                        <Table
                            headers={['字段', '类型', '说明']}
                            rows={[
                                ['id', 'String cuid', '主键，也是文件系统上的存储文件名'],
                                ['conversationId', 'String', 'FK → Conversation（onDelete: Cascade）'],
                                ['source', 'ImageSource', 'USER_UPLOAD / GENERATED / URL_FETCHED'],
                                ['mimeType', 'String', '由 `lib/images/mime.ts` 的 detectMime() 检测写入'],
                                ['sizeBytes / width / height', 'Int / Int?', '图像尺寸元数据'],
                                ['modelIdAtTime', 'String?', '仅 GENERATED 时非 null；FK → Model（onDelete: SetNull）'],
                                ['originalUrl', 'String?', '仅 URL_FETCHED 时非 null，记录原始来源 URL'],
                            ]}
                            striped
                        />
                    </Stack>
                </CardBody>
            </Card>

            <Card collapsible defaultOpen>
                <CardHeader trailing={<Pill size="sm">全局</Pill>}>SearchToolBinding · 搜索工具绑定</CardHeader>
                <CardBody>
                    <Stack gap={8}>
                        <Text size="small">
                            全局级别绑定，不与会话关联。`tool` 字段 unique，每类搜索工具最多绑定一个 Model。工具注册时 `buildAvailableTools()` 读取此表决定 `web-search` / `image-search` 是否出现在 ToolSet 中。删除关联 Model 时绑定一并级联删除。
                        </Text>
                        <Table
                            headers={['字段', '类型', '说明']}
                            rows={[
                                ['id', 'String cuid', '主键'],
                                ['tool', 'SearchTool @unique', 'WEB_SEARCH / IMAGE_SEARCH'],
                                ['modelId', 'String', 'FK → Model（onDelete: Cascade）'],
                            ]}
                            striped
                        />
                    </Stack>
                </CardBody>
            </Card>

            <Divider />

            <H2>枚举</H2>
            <Grid columns={2} gap={12}>
                <Stack gap={6}>
                    <Text weight="semibold">ModelType</Text>
                    <Table
                        headers={['值', '用途']}
                        rows={[
                            ['LLM', '语言模型'],
                            ['IMAGE', '图像生成模型'],
                            ['SEARCH', '搜索 API（Brave Search）'],
                        ]}
                    />
                </Stack>
                <Stack gap={6}>
                    <Text weight="semibold">SelectionRole</Text>
                    <Table
                        headers={['值', '驱动行为']}
                        rows={[
                            ['LLM', '推理模型，`buildLlmLanguageModel()`（Catalog `buildLanguageModel`）后传给 ToolLoopAgent'],
                            ['IMAGE_PRIMARY', '暴露 image-generate-primary 工具'],
                            ['IMAGE_SECONDARY', '暴露 image-generate-secondary 工具'],
                        ]}
                    />
                </Stack>
                <Stack gap={6}>
                    <Text weight="semibold">registerId（节选）</Text>
                    <Text size="small" tone="secondary">
                        **可绑定的 SKU 以 Catalog 为准**；展示用完整列表由 **`listRegisterMetadata(type)`** 提供，设置页打开表单时 **`GET /api/register-metadata?type=LLM|IMAGE|SEARCH`** 拉取标题与 sortOrder。
                    </Text>
                    <Table
                        headers={['registerId', 'type', '工厂 / 工具']}
                        rows={[
                            ['openai/official', 'LLM', '@ai-sdk/openai'],
                            ['openai-compatible/generic', 'LLM', '@ai-sdk/openai-compatible'],
                            ['alibaba/dashscope-llm', 'LLM', '@ai-sdk/alibaba'],
                            ['brave/search', 'SEARCH', 'Brave Search API（web-search / image-search）'],
                            ['volcengine/seedream', 'IMAGE', 'Seedream HTTP 同步接口'],
                            ['dashscope/wan-image', 'IMAGE', 'DashScope 多模态 messages 接口'],
                        ]}
                    />
                </Stack>
                <Stack gap={6}>
                    <Text weight="semibold">ImageSource</Text>
                    <Table
                        headers={['值', '写入场景']}
                        rows={[
                            ['USER_UPLOAD', '用户通过 Composer 上传'],
                            ['GENERATED', 'Agent 调用 image-generate 工具生成'],
                            ['URL_FETCHED', 'Agent 调用 image-fetch 工具从 URL 下载'],
                        ]}
                    />
                </Stack>
            </Grid>

            <Divider />

            <H2>Settings UI 与数据表的对应关系</H2>
            <Table
                headers={['Settings 页面区域', '操作', '对应表 / 字段']}
                rows={[
                    ['Register 下拉 / 单行提示', 'Client fetch', '`GET /api/register-metadata`，按 type 分支；条目 ≤1 时可隐藏下拉'],
                    ['LLM 模型表单', 'POST /api/models', 'registerId + name（显示名）+ config.modelId + apiKey 等'],
                    ['图像模型表单', 'POST /api/models', 'registerId + name + config.requestModel + capabilities（含 supportedSizes · maxReferenceImages）'],
                    ['Search 模型表单', 'POST /api/models', 'registerId（如 brave/search）+ name + config.apiKey'],
                    ['LLM / 图像 / 搜索列表', '新增 / 删除', 'Model'],
                    ['搜索工具绑定表单', '绑定 / 解绑', 'SearchToolBinding（tool + modelId）'],
                    ['对话页 LLM / 图像选择器', '切换', 'ConversationModelSelection'],
                ]}
                striped
            />
        </Stack>
    )
}
