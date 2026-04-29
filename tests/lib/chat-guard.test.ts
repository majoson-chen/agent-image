/**
 * U6/U7 — R3 门闸：canSendMessage / getSubmitButtonState 逻辑单元测试
 */
import { describe, expect, it } from 'vitest'
import { canSendMessage, getGateHint, getSubmitButtonState } from '../../lib/chat-guard'

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

describe('getSubmitButtonState', () => {
    it('status=ready + input non-empty → send enabled', () => {
        const state = getSubmitButtonState({ status: 'ready', llmSelected: true, inputEmpty: false })
        expect(state.kind).toBe('send')
        if (state.kind === 'send') expect(state.disabled).toBe(false)
    })

    it('status=ready + input empty → send disabled', () => {
        const state = getSubmitButtonState({ status: 'ready', llmSelected: true, inputEmpty: true })
        expect(state.kind).toBe('send')
        if (state.kind === 'send') expect(state.disabled).toBe(true)
    })

    it('status=ready + no LLM → send disabled', () => {
        const state = getSubmitButtonState({ status: 'ready', llmSelected: false, inputEmpty: false })
        expect(state.kind).toBe('send')
        if (state.kind === 'send') expect(state.disabled).toBe(true)
    })

    it('status=streaming → stop', () => {
        const state = getSubmitButtonState({ status: 'streaming', llmSelected: true, inputEmpty: false })
        expect(state.kind).toBe('stop')
    })

    it('status=submitted → stop', () => {
        const state = getSubmitButtonState({ status: 'submitted', llmSelected: true, inputEmpty: false })
        expect(state.kind).toBe('stop')
    })

    it('status=error + input non-empty → send enabled', () => {
        const state = getSubmitButtonState({ status: 'error', llmSelected: true, inputEmpty: false })
        expect(state.kind).toBe('send')
        if (state.kind === 'send') expect(state.disabled).toBe(false)
    })
})
