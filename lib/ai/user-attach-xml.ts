/**
 * 用户 Composer 附件对应的视觉说明 XML（与紧随其后的 file parts 顺序对齐）。
 * 无 server-only，可与前端共用标签名与检测辅助。
 */

export const USER_ATTACH_XML_TAG = 'agent-image-user-attach'

export interface UserAttachSlotInput {
    imageId: string
    mimeType: string
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

/** 判断 user 文本 part 是否为用户上传附件注入块 */
export function isUserAttachInjectText(text: string): boolean {
    const t = text.trimStart()
    return t.startsWith(`<${USER_ATTACH_XML_TAG}`)
}

/**
 * 生成完整 XML 片段（无 XML 声明）。slot 序号从 1 递增，与 file part 列顺序一致。
 */
export function buildUserAttachXml(images: UserAttachSlotInput[]): string {
    const lines: string[] = []
    lines.push(`<${USER_ATTACH_XML_TAG} version="1">`)
    lines.push(
        '<instructions>紧随本段之后的图像 file part 与下方 slot 元素按顺序一一对应。</instructions>',
    )
    lines.push('<images>')
    let slot = 1
    for (const img of images) {
        lines.push(
            `<slot n="${slot}" imageId="${escapeXmlAttr(img.imageId)}" mimeType="${escapeXmlAttr(img.mimeType)}"/>`,
        )
        slot++
    }
    lines.push('</images>')
    lines.push(`</${USER_ATTACH_XML_TAG}>`)
    return lines.join('')
}
