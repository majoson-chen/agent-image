import { calcUsagePercent, formatUsage } from '@lib/usage-calc'
/**
 * U7 — 上下文用量计算单元测试
 */
import { describe, expect, it } from 'vitest'

describe('calcUsagePercent', () => {
    it('returns 0 when no usage', () => {
        expect(calcUsagePercent(null, 128000)).toBe(0)
    })

    it('calculates percentage correctly', () => {
        expect(calcUsagePercent(64000, 128000)).toBe(50)
    })

    it('clamps to 100 when over limit', () => {
        expect(calcUsagePercent(200000, 128000)).toBe(100)
    })

    it('returns 0 when contextWindow is 0', () => {
        expect(calcUsagePercent(100, 0)).toBe(0)
    })

    it('rounds to integer', () => {
        expect(Number.isInteger(calcUsagePercent(12345, 128000))).toBe(true)
    })
})

describe('formatUsage', () => {
    it('formats large numbers with k suffix', () => {
        expect(formatUsage(64000)).toBe('64k')
    })

    it('formats small numbers without suffix', () => {
        expect(formatUsage(500)).toBe('500')
    })

    it('handles null as 0', () => {
        expect(formatUsage(null)).toBe('0')
    })
})
