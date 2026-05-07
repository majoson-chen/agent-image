'use client'

/* eslint-disable next/no-img-element, react/no-array-index-key -- 对话区同源 /api/images；UIMessage.parts 子项无统一稳定 key */

import type { ImageModelCapabilities } from '@lib/validation/image-model-schema'
import type { UIMessage } from 'ai'
import type { ComposerLlmModelOption } from './ComposerLlmSlot'
import { useChat } from '@ai-sdk/react'
import { buildUserAttachXml, isUserAttachInjectText } from '@lib/ai/user-attach-xml'
import { isImageFetchVisionPersistParts } from '@lib/ai/vision-inject-xml'
import { getGateHint, getSubmitButtonState } from '@lib/chat-guard'
import { buildNarrowChatPostBody } from '@lib/chat/narrow-chat-transport-body'
import { cn } from '@lib/cn'
import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import { Check, ChevronDown, ChevronUp, Send, Square, X } from 'lucide-react'
import { useState } from 'react'
import { Streamdown } from 'streamdown'
import { ComposerAttachments } from './ComposerAttachments'
import { ComposerImageSlot } from './ComposerImageSlot'
import { ComposerLlmSlot } from './ComposerLlmSlot'
import { ContextUsageBar } from './ContextUsageBar'

/** Streamdown 插件集（安装即用，与官方 README 一致） */
const streamdownPlugins = { code, mermaid, math, cjk }

interface MessageMetadata {
    usage?: { inputTokens: number, outputTokens: number, totalTokens: number }
}

interface ToolPart {
    type: string
    state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | 'output-denied'
    toolCallId?: string
    input?: unknown
    output?: unknown
    errorText?: string
    approval?: { id?: string, approved?: boolean, reason?: string }
}

interface ImageGeneratePart {
    type: string // 'tool-image-generate-primary' | 'tool-image-generate-secondary'
    state:
        | 'input-streaming'
        | 'input-available'
        | 'approval-requested'
        | 'approval-responded'
        | 'executing'
        | 'output-available'
        | 'output-error'
        | 'output-denied'
    toolCallId?: string
    input?: { prompt?: string }
    output?: { imageId?: string, imageIds?: string[] }
    errorText?: string
    approval?: { id: string, approved?: boolean, reason?: string }
}

function ImageGenerateBlock({
    part,
    onApprove,
    onDeny,
}: {
    part: ImageGeneratePart
    onApprove: (id: string) => void
    onDeny: (id: string) => void
}) {
    const isSecondary = part.type === 'tool-image-generate-secondary'
    const label = isSecondary ? '次生图' : '主生图'

    if (part.state === 'input-streaming') {
        return (
            <div className="card card-compact border border-base-300 bg-base-200">
                <div className="card-body py-2 flex flex-row items-center gap-2">
                    <span className="loading loading-spinner loading-xs" />
                    <span className="text-sm text-base-content/60">
                        准备调用
                        {label}
                        …
                    </span>
                </div>
            </div>
        )
    }

    if (part.state === 'input-available') {
        return (
            <div className="card card-compact border border-base-300 bg-base-200">
                <div className="card-body py-2">
                    <span className="text-sm font-medium">{label}</span>
                    {part.input?.prompt && (
                        <p className="text-xs text-base-content/60 line-clamp-2">{part.input.prompt}</p>
                    )}
                    <span className="text-xs text-base-content/50">等待结果…</span>
                </div>
            </div>
        )
    }

    if (part.state === 'approval-responded') {
        return (
            <div className="card card-compact border border-base-300 bg-base-200">
                <div className="card-body py-2 flex flex-row items-center gap-2">
                    <span className="loading loading-spinner loading-xs" />
                    <span className="text-sm text-base-content/60">已确认，准备生成…</span>
                </div>
            </div>
        )
    }

    if (part.state === 'approval-requested') {
        return (
            <div className="card border border-warning bg-base-200">
                <div className="card-body py-3">
                    <p className="text-sm font-medium">
                        确认调用
                        {label}
                        ？
                    </p>
                    {part.input?.prompt && (
                        <p className="text-xs text-base-content/60 line-clamp-3">
                            提示词：
                            {part.input.prompt}
                        </p>
                    )}
                    <div className="flex gap-2 mt-2">
                        <button
                            type="button"
                            className="btn btn-primary btn-sm gap-1.5"
                            onClick={() => part.approval?.id && onApprove(part.approval.id)}
                        >
                            <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                            确认
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm gap-1.5"
                            onClick={() => part.approval?.id && onDeny(part.approval.id)}
                        >
                            <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                            拒绝
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (part.state === 'executing') {
        return (
            <div className="card card-compact border border-base-300 bg-base-200">
                <div className="card-body py-2 flex flex-row items-center gap-2">
                    <span className="loading loading-spinner loading-xs" />
                    <span className="text-sm text-base-content/60">生成中…</span>
                </div>
            </div>
        )
    }

    if (part.state === 'output-available') {
        const output = part.output
        const imageIds: string[] = output?.imageIds ?? (output?.imageId ? [output.imageId] : [])
        return (
            <div className="card card-compact border border-base-300 bg-base-200">
                <div className="card-body py-2">
                    <span className="text-xs font-medium text-base-content/60">
                        {label}
                        结果
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {imageIds.map(id => (
                            <img
                                key={id}
                                src={`/api/images/${id}`}
                                loading="lazy"
                                className="max-h-48 rounded object-contain cursor-pointer"
                                alt="生成图"
                                onClick={() => window.open(`/api/images/${id}`)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (part.state === 'output-error') {
        return (
            <div className="alert alert-error py-2 text-sm">
                <span className="font-medium">{label}</span>
                <span className="ml-2 opacity-75">{part.errorText ?? '生图失败'}</span>
            </div>
        )
    }

    if (part.state === 'output-denied') {
        const denyReason = part.approval?.reason ?? '用户未批准'
        return (
            <div className="alert alert-warning py-2 text-sm">
                <span className="font-medium">{label}</span>
                <span className="ml-2 opacity-75">
                    已拒绝：
                    {denyReason}
                </span>
            </div>
        )
    }

    return null
}

interface ImageModelInfo {
    id: string
    name: string
    capabilities: ImageModelCapabilities | null
}

interface Props {
    conversationId: string
    initialMessages: UIMessage<MessageMetadata>[]
    hasLlm: boolean
    llmModels?: ComposerLlmModelOption[]
    llmModelId?: string | null
    contextWindow?: number
    imageModels?: ImageModelInfo[]
    primaryImageModelId?: string | null
    primaryImageSize?: string | null
    secondaryImageModelId?: string | null
    secondaryImageSize?: string | null
}

// 工具调用名称展示
function toolDisplayName(type: string): string {
    const name = type.replace(/^tool-/, '')
    const map: Record<string, string> = {
        'web-search': '网页搜索',
        'image-search': '图像搜索',
        'web-fetch': '抓取网页',
        'conversation-rename': '会话标题',
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

    if (part.state === 'output-denied') {
        const denyReason = part.approval?.reason ?? '用户未批准'
        return (
            <div className="alert alert-warning py-2 text-sm">
                <span className="font-medium">{label}</span>
                <span className="ml-2 opacity-75">
                    已拒绝：
                    {denyReason}
                </span>
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
                            className="btn btn-link btn-xs h-auto min-h-0 gap-1 p-0 text-primary underline"
                            onClick={() => setExpanded(v => !v)}
                        >
                            {expanded ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
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

export function ChatPage({
    conversationId,
    initialMessages,
    hasLlm,
    llmModels = [],
    llmModelId = null,
    contextWindow,
    imageModels = [],
    primaryImageModelId = null,
    primaryImageSize = null,
    secondaryImageModelId = null,
    secondaryImageSize = null,
}: Props) {
    const [input, setInput] = useState('')
    const [pendingAttachments, setPendingAttachments] = useState<{ id: string, mimeType: string }[]>([])
    const [abortedMessageIds, setAbortedMessageIds] = useState<Set<string>>(() => new Set())

    const { messages, sendMessage, stop, status, error, clearError, addToolApprovalResponse } = useChat<UIMessage<MessageMetadata>>({
        id: conversationId,
        messages: initialMessages,
        transport: new DefaultChatTransport({
            api: '/api/chat',
            prepareSendMessagesRequest: ({ messages, trigger, messageId }) => ({
                body: buildNarrowChatPostBody({
                    conversationId,
                    trigger,
                    messageId,
                    messages,
                }),
            }),
        }),
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
        onFinish: ({ message, isAbort }) => {
            if (isAbort) {
                setAbortedMessageIds(prev => new Set(prev).add(message.id))
            }
        },
    })

    const btnState = getSubmitButtonState({
        status,
        llmSelected: hasLlm,
        inputEmpty: !input.trim(),
        hasAttachments: pendingAttachments.length > 0,
    })
    const gateHint = getGateHint({ llmSelected: hasLlm })

    const lastMessage = messages.at(-1)
    const assistantStreaming = status === 'streaming' && lastMessage?.role === 'assistant'

    // 从最后一条 assistant 消息的 metadata 获取 usage
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    const totalTokens = (lastAssistant?.metadata as MessageMetadata | undefined)?.usage?.totalTokens ?? null

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (btnState.kind === 'stop') {
            stop()
            return
        }
        if (btnState.kind === 'send' && !btnState.disabled) {
            if (error)
                clearError()
            const parts: object[] = []
            if (pendingAttachments.length > 0) {
                parts.push({
                    type: 'text',
                    text: buildUserAttachXml(pendingAttachments.map(a => ({ imageId: a.id, mimeType: a.mimeType }))),
                })
            }
            const trimmed = input.trim()
            if (trimmed)
                parts.push({ type: 'text', text: trimmed })
            for (const a of pendingAttachments) {
                parts.push({
                    type: 'file',
                    mediaType: a.mimeType,
                    url: `/api/images/${a.id}`,
                })
            }
            sendMessage({ parts } as Parameters<typeof sendMessage>[0])
            setInput('')
            setPendingAttachments([])
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Escape' && btnState.kind === 'stop') {
            stop()
        }
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-base-100">
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
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto flex max-w-2xl flex-col gap-4">
                    {messages
                        .filter(m => !(m.role === 'user' && isImageFetchVisionPersistParts(m.parts)))
                        .map(m => (
                            <div key={m.id} className={cn(m.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-2')}>
                                {m.role === 'user'
                                    ? (
                                            <div className="rounded-box flex max-w-prose flex-col gap-2 bg-primary px-4 py-3 text-sm text-primary-content">
                                                {m.parts.map((part, i) => {
                                                    const p = part as { type: string, text?: string, url?: string, mediaType?: string }
                                                    if (p.type === 'text') {
                                                        if (typeof p.text === 'string' && isUserAttachInjectText(p.text))
                                                            return null
                                                        return <span key={i} className="whitespace-pre-wrap">{p.text}</span>
                                                    }
                                                    if (p.type === 'file' && typeof p.url === 'string') {
                                                        if (p.url.startsWith('/api/images/')) {
                                                            return (
                                                                <img
                                                                    key={i}
                                                                    src={p.url}
                                                                    loading="lazy"
                                                                    className="max-h-48 rounded object-contain border border-base-300"
                                                                    alt=""
                                                                />
                                                            )
                                                        }
                                                        if (p.url.startsWith('data:image/')) {
                                                            return (
                                                                <img
                                                                    key={i}
                                                                    src={p.url}
                                                                    loading="lazy"
                                                                    className="max-h-48 rounded object-contain border border-base-300"
                                                                    alt=""
                                                                />
                                                            )
                                                        }
                                                    }
                                                    return null
                                                })}
                                            </div>
                                        )
                                    : (
                                            <>
                                                {m.parts.map((part, i) => {
                                                    if (part.type === 'text') {
                                                        const streamAnimating = assistantStreaming && m.id === lastMessage?.id
                                                        return (
                                                            <div
                                                                key={i}
                                                                className="rounded-box max-w-prose min-w-0 bg-base-200 px-4 py-3 text-sm text-base-content"
                                                            >
                                                                <Streamdown
                                                                    animated
                                                                    controls={{ table: true, code: true, mermaid: true }}
                                                                    isAnimating={streamAnimating}
                                                                    plugins={streamdownPlugins}
                                                                    translations={{
                                                                        close: '关闭',
                                                                        copied: '已复制',
                                                                        copyCode: '复制代码',
                                                                        copyLink: '复制链接',
                                                                        copyTable: '复制表格',
                                                                        copyTableAsCsv: '复制为 CSV',
                                                                        copyTableAsMarkdown: '复制为 Markdown',
                                                                        copyTableAsTsv: '复制为 TSV',
                                                                        downloadDiagram: '下载图表',
                                                                        downloadDiagramAsMmd: '下载 .mmd',
                                                                        downloadDiagramAsPng: '下载 PNG',
                                                                        downloadDiagramAsSvg: '下载 SVG',
                                                                        downloadFile: '下载文件',
                                                                        downloadImage: '下载图片',
                                                                        downloadTable: '下载表格',
                                                                        downloadTableAsCsv: '表格下载为 CSV',
                                                                        downloadTableAsMarkdown: '表格下载为 Markdown',
                                                                        exitFullscreen: '退出全屏',
                                                                        externalLinkWarning: '即将打开外部链接，是否继续？',
                                                                        imageNotAvailable: '图片不可用',
                                                                        mermaidFormatMmd: 'Mermaid (.mmd)',
                                                                        mermaidFormatPng: 'PNG',
                                                                        mermaidFormatSvg: 'SVG',
                                                                        openExternalLink: '打开',
                                                                        openLink: '打开链接',
                                                                        tableFormatCsv: 'CSV',
                                                                        tableFormatMarkdown: 'Markdown',
                                                                        tableFormatTsv: 'TSV',
                                                                        viewFullscreen: '全屏查看',
                                                                    }}
                                                                >
                                                                    {part.text}
                                                                </Streamdown>
                                                            </div>
                                                        )
                                                    }
                                                    if (part.type === 'step-start') {
                                                        return <hr key={i} className="border-base-300" />
                                                    }
                                                    if (part.type.startsWith('tool-image-generate-')) {
                                                        return (
                                                            <ImageGenerateBlock
                                                                key={i}
                                                                part={part as unknown as ImageGeneratePart}
                                                                onApprove={id => addToolApprovalResponse({ id, approved: true })}
                                                                onDeny={id => addToolApprovalResponse({ id, approved: false })}
                                                            />
                                                        )
                                                    }
                                                    if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
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

            {/* 输入区（设计稿：用量与 LLM | 主生图 | 次生图 在输入框上方同一带） */}
            <div className="relative z-10 shrink-0 overflow-visible border-t border-base-300 bg-base-100 px-4 py-3">
                <div className="mx-auto max-w-2xl">
                    <div className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-base-300 pb-3">
                        {contextWindow && (
                            <ContextUsageBar totalTokens={totalTokens} contextWindow={contextWindow} />
                        )}
                        <ComposerLlmSlot
                            conversationId={conversationId}
                            currentModelId={llmModelId}
                            models={llmModels}
                        />
                        <ComposerImageSlot
                            conversationId={conversationId}
                            role="IMAGE_PRIMARY"
                            currentModelId={primaryImageModelId}
                            currentSize={primaryImageSize}
                            models={imageModels}
                        />
                        <ComposerImageSlot
                            conversationId={conversationId}
                            role="IMAGE_SECONDARY"
                            currentModelId={secondaryImageModelId}
                            currentSize={secondaryImageSize}
                            models={imageModels}
                        />
                    </div>
                    {gateHint && (
                        <p className="mb-2 text-xs text-warning">{gateHint}</p>
                    )}
                    <ComposerAttachments
                        conversationId={conversationId}
                        items={pendingAttachments}
                        onChange={setPendingAttachments}
                        disabled={!hasLlm || status === 'streaming' || status === 'submitted'}
                    />
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
                            className={cn('btn btn-sm gap-1.5 px-4', btnState.kind === 'stop' ? 'btn-error' : 'btn-primary')}
                        >
                            {btnState.kind === 'stop'
                                ? (
                                        <>
                                            <Square className="size-3.5 fill-current" strokeWidth={0} aria-hidden />
                                            停止
                                        </>
                                    )
                                : (
                                        <>
                                            <Send className="size-3.5" strokeWidth={2} aria-hidden />
                                            发送
                                        </>
                                    )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
