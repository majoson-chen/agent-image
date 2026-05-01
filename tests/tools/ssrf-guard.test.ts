import { assertPublicHttpUrl } from '@lib/tools/ssrf-guard'
/**
 * U4 — SSRF guard 单测（test-first）
 */
import { describe, expect, it } from 'vitest'

describe('assertPublicHttpUrl', () => {
    // 合法公网 URL
    it('passes public http URL', () => {
        const url = assertPublicHttpUrl('http://example.com/page')
        expect(url.hostname).toBe('example.com')
    })

    it('passes public https URL', () => {
        const url = assertPublicHttpUrl('https://api.search.brave.com/v1')
        expect(url.protocol).toBe('https:')
    })

    it('passes public IP literal 8.8.8.8', () => {
        expect(() => assertPublicHttpUrl('https://8.8.8.8')).not.toThrow()
    })

    // 非法协议
    it('rejects file: protocol', () => {
        expect(() => assertPublicHttpUrl('file:///etc/passwd')).toThrow('only http/https allowed')
    })

    it('rejects ftp: protocol', () => {
        expect(() => assertPublicHttpUrl('ftp://example.com')).toThrow('only http/https allowed')
    })

    // 本地回环
    it('rejects localhost', () => {
        expect(() => assertPublicHttpUrl('http://localhost/x')).toThrow('private network not allowed')
    })

    it('rejects 127.0.0.1', () => {
        expect(() => assertPublicHttpUrl('http://127.0.0.1')).toThrow('private network not allowed')
    })

    it('rejects 127.x.x.x', () => {
        expect(() => assertPublicHttpUrl('http://127.0.0.100')).toThrow('private network not allowed')
    })

    // 私有网段 10.x.x.x
    it('rejects 10.0.0.1', () => {
        expect(() => assertPublicHttpUrl('http://10.0.0.1')).toThrow('private network not allowed')
    })

    it('rejects 10.255.255.255', () => {
        expect(() => assertPublicHttpUrl('http://10.255.255.255')).toThrow('private network not allowed')
    })

    // 私有网段 172.16.x.x – 172.31.x.x
    it('rejects 172.16.0.1', () => {
        expect(() => assertPublicHttpUrl('http://172.16.0.1')).toThrow('private network not allowed')
    })

    it('rejects 172.31.255.255', () => {
        expect(() => assertPublicHttpUrl('http://172.31.255.255')).toThrow('private network not allowed')
    })

    it('passes 172.32.0.1 (outside private range)', () => {
        expect(() => assertPublicHttpUrl('http://172.32.0.1')).not.toThrow()
    })

    // 私有网段 192.168.x.x
    it('rejects 192.168.1.1', () => {
        expect(() => assertPublicHttpUrl('http://192.168.1.1')).toThrow('private network not allowed')
    })

    // 链路本地 169.254.x.x
    it('rejects 169.254.1.1', () => {
        expect(() => assertPublicHttpUrl('http://169.254.1.1')).toThrow('private network not allowed')
    })

    // IPv6 loopback
    it('rejects ::1', () => {
        expect(() => assertPublicHttpUrl('http://[::1]')).toThrow('private network not allowed')
    })

    // 无效 URL
    it('rejects invalid URL string', () => {
        expect(() => assertPublicHttpUrl('not-a-url')).toThrow('invalid URL')
    })
})
