import {
  Card, CardBody, CardHeader, Divider,
  H1, H2, Pill, Stack, Table, Text,
} from 'cursor/canvas'

export default function ProviderFactory() {
  return (
    <Stack gap={24} style={{ padding: 24 }}>
      <Stack gap={6}>
        <H1>Provider 工厂</H1>
        <Text tone="secondary">
          负责将 DB 中的 Model 记录转换为可执行对象。LLM 工厂和图像工厂在职责上有本质区别：LLM 工厂返回一个 AI SDK LanguageModel 实例供 Agent 持有并反复使用；图像工厂则在每次工具调用时直接执行生成、下载图像并落盘，返回落盘结果。
        </Text>
      </Stack>

      <Divider />

      <H2>LLM 工厂链</H2>
      <Text tone="secondary" size="small">lib/llm-provider-factory.ts · buildLlmModel(model: Model): LanguageModel</Text>
      <Text>
        接收一条 ModelType = LLM 的 Model 记录，根据 providerType 分支选择对应的 AI SDK provider 包，创建并返回 LanguageModel 实例。实例随后被传入 buildAgent() 供 ToolLoopAgent 使用。
      </Text>
      <Table
        headers={['providerType', '使用包', '必填字段', '可选字段']}
        rows={[
          ['OPENAI', '@ai-sdk/openai · createOpenAI()', 'apiKey', '— （baseURL 忽略）'],
          ['OPENAI_COMPATIBLE', '@ai-sdk/openai-compatible · createOpenAICompatible()', 'apiKey · baseURL', 'extraHeaders'],
          ['ALIBABA', '@ai-sdk/alibaba · createAlibaba()', 'apiKey', 'baseURL · extraHeaders'],
        ]}
        striped
      />

      <Divider />

      <H2>LLM 附加选项</H2>
      <Text tone="secondary" size="small">lib/llm-chat-provider-options.ts · computeLlmChatProviderOptions(model, params): ProviderOptions | undefined</Text>
      <Text>
        在 chat route 中与 buildLlmModel() 并行调用，返回一个 AI SDK ProviderOptions 对象，经由 buildAgent() 的 providerOptions 参数注入 ToolLoopAgent。当前主要用于控制 thinking mode 等模型级参数。当 deps.model 存在（测试注入路径）时，此函数被跳过。
      </Text>

      <Divider />

      <H2>图像工厂链</H2>
      <Text tone="secondary" size="small">lib/image-provider-factory.ts · executeImageGeneration(input): Promise&lt;imageId, mimeType, sizeBytes&gt;</Text>
      <Text>
        由 lib/tools/image-generate.ts 在工具执行时调用，入参含 model、prompt、size、conversationId、prisma。根据 model.providerType 分支到两条执行路径，均以「HTTP 请求 → 下载图像 → detectMime() 检测 MIME → createImage() 落库」结束，返回图像 ID 与元数据。
      </Text>

      <Card>
        <CardHeader trailing={<Pill size="sm">VOLCENGINE_SEEDREAM</Pill>}>Seedream 路径</CardHeader>
        <CardBody>
          <Stack gap={6}>
            <Text size="small">
              同步接口。POST 请求体含 model、prompt、size 三个字段，响应直接包含图像 URL，下载后落盘。超时 30s（AbortSignal.timeout）。API 地址优先使用 model.baseURL，为空时回退到 seedream-presets.ts 中的 SEEDREAM_DEFAULT_API_BASE_URL。
            </Text>
            <Text size="small" tone="secondary">
              响应 URL 解析顺序：data[0].url → images[0].url → json.url（兼容多种响应结构）。
            </Text>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader trailing={<Pill size="sm">DASHSCOPE_WAN_IMAGE</Pill>}>DashScope WAN 路径</CardHeader>
        <CardBody>
          <Stack gap={6}>
            <Text size="small">
              对话式接口。请求体使用 messages 数组（role: user，content 含 text prompt），parameters 中含经 mapSizeToDashscopeParameter() 映射后的 size、thinking_mode 等参数。超时 120s。API 地址同样优先 model.baseURL，回退到 WAN_IMAGE_DEFAULT_API_URL。
            </Text>
            <Text size="small" tone="secondary">
              响应 URL 解析：遍历 output.choices[0].message.content 数组，取第一个 image 类型 part 的 image 字段。
            </Text>
          </Stack>
        </CardBody>
      </Card>

      <Divider />

      <H2>Presets 文件</H2>
      <Text>两个 presets 文件集中管理各图像 Provider 的默认 API 地址和参数规范，避免散落在工厂函数内。</Text>
      <Table
        headers={['文件', '导出内容', '用途']}
        rows={[
          ['lib/image/seedream-presets.ts', 'SEEDREAM_DEFAULT_API_BASE_URL', 'Seedream 默认 API 地址，model.baseURL 为空时使用'],
          ['lib/image/wan-image-presets.ts', 'WAN_IMAGE_DEFAULT_API_URL · mapSizeToDashscopeParameter(size, modelName)', 'WAN 默认 API 地址；尺寸字符串（WxH / 1K / 2K / 4K）到 DashScope size 参数的映射函数，4K 仅 Pro 模型支持'],
        ]}
        striped
      />
    </Stack>
  )
}
