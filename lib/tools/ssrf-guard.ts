import 'server-only'

// IPv4 私有段检查：返回 true 表示是私有地址
function isPrivateIPv4(hostname: string): boolean {
    const parts = hostname.split('.').map(Number)
    if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255))
        return false

    const a = parts[0]!
    const b = parts[1]!
    // 127.0.0.0/8
    if (a === 127)
        return true
    // 10.0.0.0/8
    if (a === 10)
        return true
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31)
        return true
    // 192.168.0.0/16
    if (a === 192 && b === 168)
        return true
    // 169.254.0.0/16（链路本地）
    if (a === 169 && b === 254)
        return true

    return false
}

// IPv6 私有/回环判断（只做基础字面量检查）
function isPrivateIPv6(hostname: string): boolean {
    // 去掉方括号（URL 中 IPv6 地址形如 [::1]）
    const h = hostname.replace(/^\[|\]$/g, '').toLowerCase()
    // ::1 回环
    if (h === '::1')
        return true
    // fc00::/7 (fc 或 fd 开头)
    if (h.startsWith('fc') || h.startsWith('fd'))
        return true
    // fe80::/10 (link-local)
    if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb'))
        return true
    return false
}

/**
 * 断言 URL 是合法的公网 http/https 地址。
 * 拒绝非 http/https 协议、localhost、私有 IP 字面量。
 * 通过则返回 URL 对象。
 */
export function assertPublicHttpUrl(input: string): URL {
    let url: URL
    try {
        url = new URL(input)
    }
    catch {
        throw new Error('invalid URL')
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error('only http/https allowed')

    const { hostname } = url
    if (hostname === 'localhost')
        throw new Error('private network not allowed')

    if (isPrivateIPv4(hostname))
        throw new Error('private network not allowed')

    if (isPrivateIPv6(hostname))
        throw new Error('private network not allowed')

    return url
}
