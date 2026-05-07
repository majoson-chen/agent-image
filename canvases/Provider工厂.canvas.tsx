import {
    Card,
    CardBody,
    CardHeader,
    Divider,
    H1,
    H2,
    Pill,
    Stack,
    Table,
    Text,
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
                接收一条 ModelType = LLM 的 Model 记录，根据 **`model.registerId`** 分支选择 AI SDK provider 包；**`config` 经 `parseModelConfig` 解析**，其中 **`modelId` 为实际请求模型名**（`name` 仅为 DB 展示标签）。实例传入 buildAgent() 供 ToolLoopAgent 使用。
            </Text>
            <Table
                headers={['registerId', '使用包', 'config 要点', '可选']}
                rows={[
                    ['openai/official', '@ai-sdk/openai · createOpenAI()', 'modelId · apiKey', '—'],
                    ['openai-compatible/generic', '@ai-sdk/openai-compatible', 'modelId · apiKey · baseURL', 'extraHeaders'],
                    ['alibaba/dashscope-llm', '@ai-sdk/alibaba · createAlibaba()', 'modelId · apiKey', 'baseURL · capabilities.supportsThinking'],
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
                由 lib/tools/image-generate.ts 在工具执行时调用，入参含 model、prompt、size、conversationId、prisma。根据 **`model.registerId`**（`volcengine/seedream` / `dashscope/wan-image`）分支；HTTP 请求的 **model** 字段来自 **`config.requestModel`**，非 DB **`name`**。路径均以「HTTP → 下载 / 解码 → detectMime → createImage 落库」结束。
            </Text>

            <Card>
                <CardHeader trailing={<Pill size="sm">volcengine/seedream</Pill>}>Seedream 路径</CardHeader>
                <CardBody>
                    <Stack gap={6}>
                        <Text size="small">
                            同步接口。POST 请求体含 model（来自 config.requestModel）、prompt、size，响应包含图像 URL 后下载落盘。超时 30s。API 优先 **config.baseURL**，为空回退 seedream-presets.ts 的 SEEDREAM_DEFAULT_API_BASE_URL。
                        </Text>
                        <Text size="small" tone="secondary">
                            响应 URL 解析顺序：data[0].url → images[0].url → json.url（兼容多种响应结构）。
                        </Text>
                    </Stack>
                </CardBody>
            </Card>

            <Card>
                <CardHeader trailing={<Pill size="sm">dashscope/wan-image</Pill>}>DashScope 万相图像路径</CardHeader>
                <CardBody>
                    <Stack gap={6}>
                        <Text size="small">
                            对话式接口。messages 中 user content 可为 text ± 参考图（data URL）；parameters 侧 size 由 mapSizeToDashscopeParameter() 映射。超时 120s。API 优先 **config.baseURL**，回退 WAN_IMAGE_DEFAULT_API_URL。万相且 **maxReferenceImages** 为正时工具可带 referenceImageIds，由路由侧拼装进 content。
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
                    ['lib/image/seedream-presets.ts', 'SEEDREAM_DEFAULT_API_BASE_URL', 'Seedream 默认 API 地址，config.baseURL 为空时使用'],
                    ['lib/image/wan-image-presets.ts', 'WAN_IMAGE_DEFAULT_API_URL · mapSizeToDashscopeParameter(size, modelName)', 'WAN 默认 API 地址；尺寸字符串（WxH / 1K / 2K / 4K）到 DashScope size 参数的映射函数，4K 仅 Pro 模型支持'],
                ]}
                striped
            />
        </Stack>
    )
}
