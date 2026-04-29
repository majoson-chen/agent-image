'use client'

import type { UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState } from 'react'
import { getGateHint, getSubmitButtonState } from '../../../lib/chat-guard'
import { cn } from '../../../lib/cn'
import { ContextUsageBar } from './ContextUsageBar'

interface MessageMetadata {
    usage?: { inputTokens: number, outputTokens: number, totalTokens: number }
}

// 工具调用 part 的通用结构（工具名动态，用宽松类型）
interface ToolPart {
    type: string // 'tool-web-search' | 'tool-image-search' | 'tool-web-fetch'
    state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
    toolCallId?: string
    input?: unknown
    output?: unknown
    errorText?: string
}

interface Props {
    conversationId: string
    initialMessages: UIMessage[]
    hasLlm: boolean
    contextWindow?: number
}

// 工具调用名称展示
function toolDisplayName(type: string): string {
    const name = type.replace(/^tool-/, '')
    const map: Record<string, string> = {
        'web-search': '网页搜索',
        'image-search': '图像搜索',
        'web-fetch': '抓取网页',
    }
    return map[name] ?? name
}

// 工具调用卡片，展示四态
function ToolCallBlock({ part }: { part: ToolPart }) {
    const label = toolDisplayName(part.type)
    const [expanded, setExpanded] = useState(false)

    if (part.state === 'output-error') {
        return (
            <div className="alert alert-error py-2 text-sm">
                <span className="font-medium">{label}</span>
                <span className="ml-2 opacity-75">{part.errorText ?? '工具执行失败'}</span>
            </div>
        )
    }

    const isLoading = part.state === 'input-streaming' || part.state === 'input-available'

    return (
        <div className="card card-compact border border-base-300 bg-base-200">
            <div className="card-body py-2">
                <div className="flex items-center gap-2">
                    {isLoading && <span className="loading loading-spinner loading-xs" />}
                    <span className="text-sm font-medium text-base-content">{label}</span>
                    {part.state === 'input-available' && (
                        <span className="text-xs text-base-content/50">等待结果…</span>
                    )}
                </div>

                {part.state === 'output-available' && (
                    <div>
                        <button
                            type="button"
                            className="text-xs text-primary underline"
                            onClick={() => setExpanded(v => !v)}
                        >
                            {expanded ? '收起结果' : '查看结果'}
                        </button>
                        {expanded && (
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs text-base-content/70">
                                {JSON.stringify(part.output, null, 2)}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export function ChatPage({ conversationId, initialMessages, hasLlm, contextWindow }: Props) {
    const [input, setInput] = useState('')
    const [abortedMessageIds, setAbortedMessageIds] = useState<Set<string>>(new Set())

    const { messages, sendMessage, stop, status, error, clearError } = useChat<UIMessage<MessageMetadata>>({
        id: conversationId,
        initialMessages,
        transport: new DefaultChatTransport({
            api: '/api/chat',
            prepareSendMessagesRequest: () => ({
                body: { conversationId },
            }),
        }),
        onFinish: ({ message, isAbort }) => {
            if (isAbort) {
                setAbortedMessageIds(prev => new Set(prev).add(message.id))
            }
        },
    })

    const btnState = getSubmitButtonState({ status, llmSelected: hasLlm, inputEmpty: !input.trim() })
    const gateHint = getGateHint({ llmSelected: hasLlm })

    // 从最后一条 assistant 消息的 metadata 获取 usage
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    const totalTokens = (lastAssistant?.metadata as MessageMetadata | undefined)?.usage?.totalTokens ?? null

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (btnState.kind === 'stop') { stop(); return }
        if (btnState.kind === 'send' && !btnState.disabled) {
            if (error) clearError()
            sendMessage({ text: input })
            setInput('')
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Escape' && btnState.kind === 'stop') {
            stop()
        }
    }

    return (
        <div className="flex h-dvh flex-col bg-base-100">
            {/* 错误 banner */}
            {error && (
                <div className="alert alert-error rounded-none text-sm">
                    <span>{error.message}</span>
                    <button type="button" className="btn btn-ghost btn-xs ml-auto" onClick={clearError}>
                        关闭
                    </button>
                </div>
            )}

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto flex max-w-2xl flex-col gap-4">
                    {messages.map(m => (
                        <div key={m.id} className={cn(m.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-2')}>
                            {m.role === 'user' ? (
                                <div className="rounded-box max-w-prose bg-primary px-4 py-3 text-sm text-primary-content">
                                    {m.parts.map((part, i) =>
                                        part.type === 'text' ? <span key={i}>{part.text}</span> : null,
                                    )}
                                </div>
                            ) : (
                                <>
                                    {m.parts.map((part, i) => {
                                        if (part.type === 'text') {
                                            return (
                                                <div key={i} className="rounded-box max-w-prose bg-base-200 px-4 py-3 text-sm text-base-content">
                                                    {part.text}
                                                </div>
                                            )
                                        }
                                        if (part.type === 'step-start') {
                                            return <hr key={i} className="border-base-300" />
                                        }
                                        if (part.type.startsWith('tool-')) {
                                            return <ToolCallBlock key={i} part={part as unknown as ToolPart} />
                                        }
                                        return null
                                    })}
                                    {abortedMessageIds.has(m.id) && (
                                        <p className="text-xs text-base-content/40">（已停止）</p>
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    {status === 'streaming' && (
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
                            onKeyDown={handleKeyDown}
                            disabled={!hasLlm}
                        />
                        <button
                            type="submit"
                            disabled={btnState.kind === 'send' && btnState.disabled}
                            className={cn('btn btn-sm px-4', btnState.kind === 'stop' ? 'btn-error' : 'btn-primary')}
                        >
                            {btnState.kind === 'stop' ? '停止' : '发送'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
