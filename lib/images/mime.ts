const MIME_TO_EXT: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
}

const ALLOWED_MIMES = new Set(Object.keys(MIME_TO_EXT))

export function mimeToExt(mime: string): string {
    const ext = MIME_TO_EXT[mime]
    if (!ext)
        throw new Error(`不支持的 MIME 类型: ${mime}`)
    return ext
}

export function isAllowedMime(mime: string): boolean {
    return ALLOWED_MIMES.has(mime)
}

export function detectMime(buffer: Buffer): string | null {
    if (buffer.length < 4)
        return null

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47)
        return 'image/png'

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF)
        return 'image/jpeg'

    // WEBP: RIFF????WEBP
    if (
        buffer.length >= 12
        && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
        && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
        return 'image/webp'
    }

    // GIF: GIF87a 或 GIF89a
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38)
        return 'image/gif'

    // BMP: BM
    if (buffer[0] === 0x42 && buffer[1] === 0x4D)
        return 'image/bmp'

    return null
}
