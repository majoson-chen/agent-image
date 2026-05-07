/**
 * DashScope OpenAI 兼容连接与文档锚点；各 LLM Register 复用 `alibabaDashscopeConnectionSchema`。
 * 说明：Kimi 多轮 `preserve_thinking` 等需在 @ai-sdk/alibaba 的请求体透传能力补齐后再接（当前 SDK 仅有 enableThinking/thinkingBudget）。
 */
import { z } from 'zod'

/** OpenAI-compat 中国内地北京默认前缀（intl 用户在设置中覆盖 baseURL） */
export const DASHSCOPE_COMPAT_BASE_MAINLAND = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

/** 仅存只读常量，不向用户收集；上下文以模型大全为准核实 */
export const DASHSCOPE_KIMI_K26_DOC = {
    /** 固定请求 model 字段 */
    modelId: 'kimi-k2.6',
    docUrl: 'https://help.aliyun.com/zh/model-studio/kimi-api',
} as const

export const DASHSCOPE_QWEN36_PLUS_DOC = {
    modelId: 'qwen3.6-plus',
    docUrl:
        'https://help.aliyun.com/zh/dashscope/developer-reference/vl-plus-quick-start/',
} as const

/** 密钥、endpoint 与阿里云 SDK 增补参数（不含 SKU 专属的 modelId） */
export const alibabaDashscopeConnectionSchema = z.object({
    apiKey: z.string().min(1),
    baseURL: z.string().url().optional(),
    extraHeaders: z.record(z.string(), z.string()).optional(),
    parallelToolCalls: z.boolean().optional(),
    capabilities: z
        .object({
            /** false 时不向百炼下发思考能力；SKU 表单默认写入 true，与「启用思考」一致 */
            supportsThinking: z.boolean().optional(),
            /** enable_thinking 为真时发往 API（未设则不传 thinking_budget） */
            thinkingBudget: z.number().positive().optional(),
        })
        .optional(),
})

export type AlibabaDashscopeConnection = z.infer<typeof alibabaDashscopeConnectionSchema>
