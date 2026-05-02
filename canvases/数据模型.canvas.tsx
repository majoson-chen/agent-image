import {
  Card, CardBody, CardHeader, Divider,
  Grid, H1, H2, Pill, Stack, Table, Text,
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
              全局模型配置表，存储 LLM、图像、搜索三类 Provider 的连接信息。工厂函数读取此表记录来实例化可执行对象。删除 Model 时，关联 `ConversationModelSelection` 与 `SearchToolBinding` 级联删除；历史 `Message` 和 `Image` 的外键置空（SetNull），保留历史记录。
            </Text>
            <Table
              headers={['字段', '类型', '说明']}
              rows={[
                ['id', 'String cuid', '主键'],
                ['type', 'ModelType', 'LLM / IMAGE / SEARCH，决定该记录归属哪类功能'],
                ['name', 'String', '模型名称，同时用作 API 请求中的 model 参数'],
                ['providerType', 'ProviderType', '决定使用哪条工厂链或执行路径'],
                ['baseURL', 'String?', 'OPENAI 类型忽略；OPENAI_COMPATIBLE / 图像 Provider 必填'],
                ['apiKey', 'String', '鉴权密钥，v1 明文存储'],
                ['contextWindow', 'Int?', 'LLM 必填（app 层校验）；IMAGE / SEARCH 为 null'],
                ['extraHeaders', 'Json?', '附加 HTTP 请求头，仅 OPENAI_COMPATIBLE 使用'],
                ['capabilities', 'Json?', '图像模型能力描述，含 supportedSizes 数组'],
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
              `parts` 字段存储 UIMessage 格式的结构化 JSON 数组（text / tool-call / tool-result 三种类型）。`id` 由 chat route 的 `runId` 控制，continuation 场景下多步推理复用同一行追写。`content` 字段为纯文本兜底，M2 起新建消息该字段为空字符串。
            </Text>
            <Table
              headers={['字段', '类型', '说明']}
              rows={[
                ['id', 'String cuid', '主键；与 chat route runId 对齐'],
                ['conversationId', 'String', 'FK → Conversation（onDelete: Cascade）'],
                ['role', 'MessageRole', 'USER / ASSISTANT / SYSTEM'],
                ['content', 'String', '纯文本兜底；M1 旧消息使用，新消息为空字符串'],
                ['parts', 'Json?', 'UIMessage parts 数组；M2 起写入，M1 旧消息为 null'],
                ['usageInputTokens / usageOutputTokens / usageTotalTokens', 'Int?', '本条消息累计 token 用量（来自 API 响应，不做估算）'],
                ['modelIdAtTime', 'String?', 'FK → Model（onDelete: SetNull）；记录生成时使用的模型 id'],
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
              二进制文件落盘在 `data/images/` 目录（由 `lib/images/storage.ts` 管理），此表仅存元数据。`id` 同时用作 `/api/images/[id]` 路由参数，前端通过该路由展示图像。
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
              ['LLM', '推理模型，buildLlmModel() 实例化后传给 ToolLoopAgent'],
              ['IMAGE_PRIMARY', '暴露 image-generate-primary 工具'],
              ['IMAGE_SECONDARY', '暴露 image-generate-secondary 工具'],
            ]}
          />
        </Stack>
        <Stack gap={6}>
          <Text weight="semibold">ProviderType</Text>
          <Table
            headers={['值', '工厂 / 执行路径']}
            rows={[
              ['OPENAI', 'LLM：@ai-sdk/openai'],
              ['OPENAI_COMPATIBLE', 'LLM：@ai-sdk/openai-compatible'],
              ['ALIBABA', 'LLM：@ai-sdk/alibaba'],
              ['BRAVE_SEARCH', '搜索：直接调 Brave Search API'],
              ['VOLCENGINE_SEEDREAM', '图像：火山引擎 Seedream'],
              ['DASHSCOPE_WAN_IMAGE', '图像：阿里云百炼 WAN'],
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
          ['LLM 模型列表', '新增 / 删除', 'Model（type = LLM）'],
          ['图像模型列表', '新增 / 删除', 'Model（type = IMAGE），capabilities 存 supportedSizes'],
          ['搜索模型列表', '新增 / 删除', 'Model（type = SEARCH）'],
          ['搜索工具绑定表单', '绑定 / 解绑', 'SearchToolBinding（tool + modelId）'],
          ['对话页 LLM 选择器', '切换', 'ConversationModelSelection（role = LLM）'],
          ['对话页图像选择器', '切换 / 清除', 'ConversationModelSelection（role = IMAGE_PRIMARY / IMAGE_SECONDARY）'],
        ]}
        striped
      />
    </Stack>
  )
}
