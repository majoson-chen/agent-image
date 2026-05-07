/** 结构化 tool result 等对错误消息的脱敏，避免把疑似密钥带进 LLM。 */
export function redactSecretsInMessage(message: string): string {
    return message
        .replace(/\bsk-\w{12,}\b/gi, '[redacted]')
        .replace(/Bearer\s+\S{10,}/gi, 'Bearer [redacted]')
}
