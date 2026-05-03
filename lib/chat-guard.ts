import type { ChatStatus } from 'ai'

interface CanSendOptions {
    llmSelected: boolean
    isStreaming?: boolean
    inputEmpty?: boolean
}

export function canSendMessage({ llmSelected, isStreaming, inputEmpty }: CanSendOptions): boolean {
    if (!llmSelected)
        return false
    if (isStreaming)
        return false
    if (inputEmpty)
        return false
    return true
}

export function getGateHint({ llmSelected }: { llmSelected: boolean }): string | null {
    if (!llmSelected)
        return '请先在对话中选择 LLM 模型，才能发送消息'
    return null
}

type SubmitButtonState
    = | { kind: 'send', disabled: boolean }
        | { kind: 'stop' }

interface SubmitButtonOptions {
    status: ChatStatus
    llmSelected: boolean
    inputEmpty: boolean
    /** 有待发送附件时允许无文字发送 */
    hasAttachments?: boolean
}

export function getSubmitButtonState({
    status,
    llmSelected,
    inputEmpty,
    hasAttachments = false,
}: SubmitButtonOptions): SubmitButtonState {
    if (status === 'streaming' || status === 'submitted')
        return { kind: 'stop' }
    // ready 或 error 状态显示「发送」
    const inputEffectivelyEmpty = inputEmpty && !hasAttachments
    const disabled = !llmSelected || inputEffectivelyEmpty
    return { kind: 'send', disabled }
}
