/**
 * image-fetch 后合成 user 消息的 XML 包裹（与紧随其后的 file parts 顺序对齐）。
 * 本文件**不**使用 server-only，供前端与服务端共用根标签名与检测辅助。
 */

/** 根元素本地名；前端可用 `text.includes(\`<${VISION_INJECT_XML_TAG}\`)` 或下方 helper */
export const VISION_INJECT_XML_TAG = 'agent-image-fetch-vision'

export interface VisionInjectBatchInput {
    toolCallId: string
    images: Array<{ imageId: string, mimeType: string }>
    failureNotes: string[]
}

function escapeXmlText(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function escapeXmlAttr(s: string): string {
    return escapeXmlText(s).replace(/"/g, '&quot;')
}

/** 判断 user 文本 part 是否为 image-fetch 视觉注入块（轻量、与具体 version 解耦） */
export function isVisionInjectUserText(text: string): boolean {
    const t = text.trimStart()
    return t.startsWith(`<${VISION_INJECT_XML_TAG}`)
}

/**
 * 生成完整 XML 文档片段（无 XML 声明）。`slot` 为全局序号，与 file part 列顺序一致。
 */
export function buildVisionInjectXml(batches: VisionInjectBatchInput[]): string {
    const lines: string[] = []
    lines.push(`<${VISION_INJECT_XML_TAG} version="1">`)
    lines.push(
        '<instructions>紧随本段之后的图像 file part 与下方 slot 元素顺序一一对应；请先阅读 failures 再分析像素。</instructions>',
    )
    lines.push('<batches>')
    let slot = 1
    for (const b of batches) {
        lines.push(`<batch toolCallId="${escapeXmlAttr(b.toolCallId)}">`)
        if (b.failureNotes.length > 0) {
            lines.push('<failures>')
            for (const n of b.failureNotes)
                lines.push(`<failure>${escapeXmlText(n)}</failure>`)
            lines.push('</failures>')
        }
        lines.push('<images>')
        for (const img of b.images) {
            lines.push(
                `<slot n="${slot}" imageId="${escapeXmlAttr(img.imageId)}" mimeType="${escapeXmlAttr(img.mimeType)}"/>`,
            )
            slot++
        }
        lines.push('</images>')
        lines.push('</batch>')
    }
    lines.push('</batches>')
    lines.push(`</${VISION_INJECT_XML_TAG}>`)
    return lines.join('')
}
