import {
  Card, CardBody, CardHeader, Divider,
  Grid, H1, H2, Pill, Stack, Table, Text, useHostTheme,
} from 'cursor/canvas'

export default function ToolSystem() {
  const theme = useHostTheme()

  return (
    <Stack gap={24} style={{ padding: 24 }}>
      <Stack gap={6}>
        <H1>工具系统</H1>
        <Text tone="secondary">
          工具集在每次请求时动态组装，不是静态注册表。组装结果不仅决定 Agent 的能力边界，还直接影响写入 system prompt 的工具声明段——Agent 只知道本次请求自己持有哪些工具。
        </Text>
      </Stack>

      <Divider />

      <H2>工具注册入口</H2>
      <Text tone="secondary" size="small">{'`lib/tools/tool-registry.ts` · buildAvailableTools(prisma, conversationId) → Promise<{ tools: ToolSet, descriptors: string[] }>'}</Text>
      <Text>
        在 `/api/chat` 收到请求后、`buildAgent()` 启动前调用。函数依次查询 `SearchToolBinding` 表（全局）和当前会话的 `ConversationModelSelection` 表，按三类条件决定每个工具是否进入最终的 `ToolSet`。`descriptors` 是组装后的工具名列表，传给 `buildSystemPrompt()` 写入 system prompt 的工具声明段。
      </Text>

      <H2>工具暴露条件</H2>
      <Table
        headers={['工具名', '类别', '暴露条件', '实现文件']}
        rows={[
          ['conversation-rename', '常驻', '始终', 'tools/conversation-rename.ts'],
          ['web-fetch', '常驻', '始终', 'tools/web-fetch.ts'],
          ['image-fetch', '常驻', '始终', 'tools/image-fetch.ts'],
          ['web-search', '绑定驱动', 'SearchToolBinding.tool = WEB_SEARCH 存在', 'tools/web-search.ts'],
          ['image-search', '绑定驱动', 'SearchToolBinding.tool = IMAGE_SEARCH 存在', 'tools/image-search.ts'],
          ['image-generate-primary', '选型驱动', 'ConversationModelSelection.role = IMAGE_PRIMARY 存在', 'tools/image-generate.ts'],
          ['image-generate-secondary', '选型驱动', 'ConversationModelSelection.role = IMAGE_SECONDARY 存在', 'tools/image-generate.ts'],
        ]}
        striped
      />

      <Divider />

      <H2>各工具详情</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader trailing={<Pill size="sm">常驻</Pill>}>conversation-rename</CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text size="small">调用 `lib/db/conversations.ts` 的 `updateConversationTitle()` 写入会话标题。Agent 通常在对话初期自动调用一次。</Text>
              <Text size="small" tone="secondary">入参：`title: string`</Text>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader trailing={<Pill size="sm">常驻</Pill>}>web-fetch</CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text size="small">从指定 URL 获取网页内容，将 HTML 转换为 Markdown 后返回。URL 先经 `lib/tools/ssrf-guard.ts` 校验，拦截私有地址段。</Text>
              <Text size="small" tone="secondary">入参：`url: string` · 出参：`content: string`</Text>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader trailing={<Pill size="sm">常驻</Pill>}>image-fetch</CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text size="small">从 URL 下载图像，保存为 `ImageSource = URL_FETCHED` 的 Image 记录，返回 `imageId`。视觉注入机制会在下一 step 前将图像内容注入 AI 消息链（详见「视觉上下文注入」画布）。</Text>
              <Text size="small" tone="secondary">入参：`url: string` · 出参：`imageId: string`</Text>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader trailing={<Pill size="sm">绑定驱动</Pill>}>web-search / image-search</CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text size="small">调用 Brave Search API 执行网页或图像搜索，返回结构化结果列表。`apiKey` 来自 `SearchToolBinding` 关联的 Model 记录，注册时从 DB 读取后传入工具工厂函数。</Text>
              <Text size="small" tone="secondary">入参：`query: string` · 出参：搜索结果数组</Text>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader trailing={<Pill size="sm">选型驱动</Pill>}>image-generate-primary / secondary</CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text size="small">调用 `lib/image-provider-factory.ts` 的 `executeImageGeneration()` 生成图像并落盘，返回 `imageId`。`params.size` 在工具注册时从 `ConversationModelSelection.params` 读取，未配置则取 `capabilities.supportedSizes[0]`。</Text>
              <Text size="small" tone="secondary">入参：`prompt: string` · 出参：`imageId: string`</Text>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader trailing={<Pill size="sm" tone="warning">安全</Pill>}>SSRF 防护</CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text size="small">`lib/tools/ssrf-guard.ts` 在 `web-fetch` 执行前调用。解析 URL hostname，拒绝私有地址范围（10.x、172.16–31.x、192.168.x、127.x、::1 等）及 `file://` 协议，防止 Server-Side Request Forgery。</Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Divider />

      <H2>工具与选型 / 绑定的连接关系</H2>
      <div style={{ padding: '12px 16px', border: `1px solid ${theme.stroke.tertiary}`, borderRadius: 6 }}>
        <Stack gap={8}>
          <Text size="small">
            <Text weight="semibold" as="span">绑定驱动工具</Text>的 `apiKey` 在 `buildAvailableTools()` 内部实时查询 `SearchToolBinding → Model`，注册时注入工具工厂函数。绑定删除后下次请求工具即消失。
          </Text>
          <Text size="small">
            <Text weight="semibold" as="span">选型驱动工具</Text>的 `model` 记录和 `params.size` 在 `buildAvailableTools()` 内部实时查询 `ConversationModelSelection → Model`，注册时注入 `createImageGenerateTool()`。选型切换或清除后下次请求立即生效。
          </Text>
        </Stack>
      </div>
    </Stack>
  )
}
