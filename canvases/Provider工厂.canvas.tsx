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
                    负责将 DB 中的 Model 记录转换为可执行对象。LLM 经 Catalog 行上的 **`buildLanguageModel`** 得到 AI SDK `LanguageModel`，供 Agent 反复使用；生图经 Catalog **`createImageGenerateTool`** 装配工具，**HTTP 与各厂商解析在 Register 侧**执行，Kernel / chat route **不做 registerId 分支枚举**。
                </Text>
            </Stack>

            <Divider />

            <H2>LLM 工厂链</H2>
            <Text tone="secondary" size="small">
                入口：`lib/providers/runtime/build-llm-from-model.ts` · **`buildLlmLanguageModel(record)`** → **`getLlmCatalogRowStrict(registerId)`**（`lib/providers/registry.ts`）→ Catalog 行钩子 **`buildLanguageModel(record)`**
            </Text>
            <Text>
                接收一条 ModelType = LLM 的 Model 记录。**`config` 经各 Register 的 `parseModelConfig` 解析**；**`modelId` 为实际请求模型名**（`name` 仅为 DB 展示标签）。实例传入 `buildAgent()` 供 ToolLoopAgent 使用。具体使用哪个 AI SDK provider 包由 **Catalog 挂载的 Register 模块**决定，而非 Kernel 内三分支工厂。
            </Text>
            <Table
                headers={['环节', '符号 / 模块', '说明']}
                rows={[
                    ['1', 'buildLlmLanguageModel', '`build-llm-from-model.ts`：校验 type = LLM'],
                    ['2', 'getLlmCatalogRowStrict', '`registry.ts`：按 `registerId` 解析 LLM Catalog 行'],
                    ['3', 'buildLanguageModel(record)', 'Catalog 行钩子：组装 LanguageModel（厂商逻辑在 Register）'],
                ]}
                striped
            />

            <Divider />

            <H2>LLM 附加选项（ProviderOptions）</H2>
            <Text tone="secondary" size="small">
                `lib/llm-chat-provider-options.ts` · **`computeLlmChatProviderOptions(model): ProviderOptions | undefined`**
            </Text>
            <Text>
                在 chat route 中与 **`buildLlmLanguageModel`** 并行调用，内部 **`getLlmCatalogRowStrict`** 后调用 Catalog 行可选钩子 **`computeLlmChatProviderOptions`**，得到 AI SDK `ProviderOptions`，经 `buildAgent()` 的 `providerOptions` 注入 ToolLoopAgent。**不是** Kernel 内_SET 或厂商名单分支；无钩子则返回 `undefined`。当 deps.model 存在（测试注入路径）时，此函数可被跳过。
            </Text>

            <Divider />

            <H2>图像工具链（Catalog → Register 执行）</H2>
            <Text tone="secondary" size="small">
                `lib/tools/image-generate.ts` · **`createImageGenerateTool(opts)`** → **`getImageCatalogRowStrict`** → Catalog 行钩子 **`createImageGenerateTool`**
            </Text>
            <Text>
                `lib/tools/tool-registry.ts` 在组装 ToolSet 时调用上述入口。**HTTP、超时、响应解析与落库路径**由各 IMAGE Register 的工具实现负责；`execute` 内可调 **`executeImageGeneration`**（`lib/providers/registers/_shared/image-execute/execute.server.ts`，经 Catalog **image.execution** 派发）。**`model` 请求字段来自 `config.requestModel`**，非 DB **`name`**。
            </Text>

            <Card>
                <CardHeader trailing={<Pill size="sm">volcengine/seedream</Pill>}>Seedream 路径（Register 实现示例）</CardHeader>
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
                <CardHeader trailing={<Pill size="sm">dashscope/wan-image</Pill>}>DashScope 万相图像路径（Register 实现示例）</CardHeader>
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
            <Text>各图像 Register 可依赖下列 presets 集中默认 API 地址与参数映射，避免散落在执行代码内。</Text>
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
