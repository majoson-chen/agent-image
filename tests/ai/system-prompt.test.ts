/**
 * U7 — system-prompt 升级测试
 */
import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../../lib/ai/system-prompt'

describe('buildSystemPrompt - image tools', () => {
    it('shows 主生图：可用 when image-generate-primary in descriptors', () => {
        const prompt = buildSystemPrompt(['web-fetch', 'image-generate-primary'])
        expect(prompt).toContain('主生图：可用')
    })

    it('shows 主生图：不可用 when image-generate-primary not in descriptors', () => {
        const prompt = buildSystemPrompt(['web-fetch'])
        expect(prompt).toContain('主生图：不可用')
    })

    it('shows 次生图：可用 when image-generate-secondary in descriptors', () => {
        const prompt = buildSystemPrompt(['image-generate-primary', 'image-generate-secondary'])
        expect(prompt).toContain('次生图：可用')
    })

    it('shows 次生图：不可用 when secondary not in descriptors', () => {
        const prompt = buildSystemPrompt(['image-generate-primary'])
        expect(prompt).toContain('次生图：不可用')
    })

    it('includes 未配置主生图 告知模板', () => {
        const prompt = buildSystemPrompt(['web-fetch'])
        expect(prompt).toContain('未配置主生图')
    })

    it('includes user approval note', () => {
        const prompt = buildSystemPrompt(['image-generate-primary'])
        expect(prompt).toContain('用户确认')
    })

    it('image-generate tools still in tool list section', () => {
        const prompt = buildSystemPrompt(['image-generate-primary', 'image-generate-secondary'])
        expect(prompt).toContain('image-generate-primary')
    })
})
