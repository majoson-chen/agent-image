/**
 * U6 — R3 门闸：canSendMessage 逻辑单元测试
 */
import { describe, expect, it } from 'vitest'
import { canSendMessage, getGateHint } from '../../lib/chat-guard'

describe('canSendMessage', () => {
    it('returns false when no LLM selected', () => {
        expect(canSendMessage({ llmSelected: false })).toBe(false)
    })

    it('returns true when LLM selected', () => {
        expect(canSendMessage({ llmSelected: true })).toBe(true)
    })

    it('returns false when streaming', () => {
        expect(canSendMessage({ llmSelected: true, isStreaming: true })).toBe(false)
    })

    it('returns false when input is empty', () => {
        expect(canSendMessage({ llmSelected: true, inputEmpty: true })).toBe(false)
    })
})

describe('getGateHint', () => {
    it('returns null when LLM is selected', () => {
        expect(getGateHint({ llmSelected: true })).toBeNull()
    })

    it('returns hint when no LLM selected', () => {
        const hint = getGateHint({ llmSelected: false })
        expect(hint).not.toBeNull()
        expect(typeof hint).toBe('string')
    })
})
