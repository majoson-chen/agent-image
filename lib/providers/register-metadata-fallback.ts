/**
 * 客户端 fallback：`/api/register-metadata` 不可用时的静态选项。
 * 数据手抄自 `REGISTER_CONFIG_CATALOG` 的 registerId + title —— **改 Catalog 时须同步更新本文件**。
 */
import type { ModelType } from '~/generated/prisma/client'

export function fallbackRegisterMetadataRows(type: ModelType): Array<{ registerId: string, title: string }> {
    if (type === 'LLM') {
        return [
            { registerId: 'openai/official', title: 'OpenAI 官方' },
            { registerId: 'openai-compatible/generic', title: 'OpenAI 兼容（通用）' },
            { registerId: 'alibaba/dashscope-kimi-k2-6', title: '阿里云百炼 Kimi K2.6' },
            { registerId: 'alibaba/dashscope-qwen3-6-plus', title: '阿里云百炼 Qwen 3.6 Plus' },
            { registerId: 'alibaba/dashscope-llm', title: '阿里云 DashScope LLM（自填模型）' },
        ]
    }
    if (type === 'IMAGE') {
        return [
            { registerId: 'volcengine/seedream', title: '火山方舟 Seedream' },
            { registerId: 'dashscope/wan-image', title: 'DashScope 万相图像' },
        ]
    }
    return [{ registerId: 'brave/search', title: 'Brave Web/Image Search' }]
}
