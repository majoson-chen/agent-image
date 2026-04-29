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
