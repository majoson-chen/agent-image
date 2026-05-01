import { buildSystemPrompt } from '@lib/ai/system-prompt'
/**
 * U7 — system-prompt 升级测试
 */
import { describe, expect, it } from 'vitest'

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

    it('image-fetch：批量 sources、items 与自检 imageId', () => {
        const prompt = buildSystemPrompt(['web-fetch'])
        expect(prompt).toContain('image-fetch')
        expect(prompt).toContain('不需要用户确认')
        expect(prompt).toContain('sources')
        expect(prompt).toContain('items')
        expect(prompt).toContain('notice')
        expect(prompt).toContain('user 消息')
        expect(prompt).toContain('agent-image-fetch-vision')
        expect(prompt).toContain('imageId')
    })

    it('image-generate tools still in tool list section', () => {
        const prompt = buildSystemPrompt(['image-generate-primary', 'image-generate-secondary'])
        expect(prompt).toContain('image-generate-primary')
    })

    it('empty descriptors: tool list does not claim web-fetch exists', () => {
        const prompt = buildSystemPrompt([])
        expect(prompt).toContain('当前无任何可用工具')
        expect(prompt).not.toContain('仅 web-fetch')
    })
})
