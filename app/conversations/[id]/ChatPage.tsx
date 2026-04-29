'use client'

import type { UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState } from 'react'
import { canSendMessage, getGateHint } from '../../../lib/chat-guard'
import { cn } from '../../../lib/cn'
import { ContextUsageBar } from './ContextUsageBar'

interface MessageMetadata {
    usage?: { inputTokens: number, outputTokens: number, totalTokens: number }
}

interface Props {
    conversationId: string
    initialMessages: UIMessage[]
    hasLlm: boolean
    contextWindow?: number
}

export function ChatPage({ conversationId, initialMessages, hasLlm, contextWindow }: Props) {
    const [input, setInput] = useState('')

    const { messages, sendMessage, status } = useChat<UIMessage<MessageMetadata>>({
        id: conversationId,
        initialMessages,
        transport: new DefaultChatTransport({
            api: '/api/chat',
            prepareSendMessagesRequest: () => ({
                body: { conversationId },
            }),
        }),
    })

    const isStreaming = status === 'streaming'
    const sendable = canSendMessage({
        llmSelected: hasLlm,
        isStreaming,
        inputEmpty: !input.trim(),
    })
    const gateHint = getGateHint({ llmSelected: hasLlm })

    // 从最后一条 assistant 消息的 metadata 获取 usage
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    const totalTokens = (lastAssistant?.metadata as MessageMetadata | undefined)?.usage?.totalTokens ?? null

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!sendable)
            return
        sendMessage({ text: input })
        setInput('')
    }

    return (
        <div className="flex h-dvh flex-col bg-base-100">
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto flex max-w-2xl flex-col gap-4">
                    {messages.map(m => (
                        <div
                            key={m.id}
                            className={cn(
                                'rounded-box max-w-prose px-4 py-3 text-sm',
                                m.role === 'user'
                                    ? 'ml-auto bg-primary text-primary-content'
                                    : 'bg-base-200 text-base-content',
                            )}
                        >
                            {m.parts.map((part, i) =>
                                part.type === 'text'
                                    ? <span key={i}>{part.text}</span>
                                    : null,
                            )}
                        </div>
                    ))}

                    {isStreaming && (
                        <span className="loading loading-dots loading-sm text-base-content/50" />
                    )}
                </div>
            </div>

            {/* 输入区 */}
            <div className="border-t border-base-300 bg-base-100 px-4 py-3">
                {contextWindow && (
                    <div className="mx-auto mb-2 max-w-2xl">
                        <ContextUsageBar totalTokens={totalTokens} contextWindow={contextWindow} />
                    </div>
                )}
                <div className="mx-auto max-w-2xl">
                    {gateHint && (
                        <p className="mb-2 text-xs text-warning">{gateHint}</p>
                    )}
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            className="input input-bordered flex-1 text-sm"
                            placeholder={hasLlm ? '输入消息…' : '请先选择 LLM 模型'}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            disabled={!hasLlm || isStreaming}
                        />
                        <button
                            type="submit"
                            disabled={!sendable}
                            className="btn btn-primary btn-sm px-4"
                        >
                            {isStreaming ? <span className="loading loading-spinner loading-xs" /> : '发送'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
