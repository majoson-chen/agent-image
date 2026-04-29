'use client'

/* eslint-disable next/no-img-element, react/no-array-index-key -- 对话区同源 /api/images；UIMessage.parts 子项无统一稳定 key */

import type { UIMessage } from 'ai'
import type { ImageModelCapabilities } from '../../../lib/validation/image-model-schema'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import { useState } from 'react'
import { canUploadMore, getGateHint, getSubmitButtonState } from '../../../lib/chat-guard'
import { cn } from '../../../lib/cn'
import { ContextUsageBar } from './ContextUsageBar'
import { ImageModelPicker } from './ImageModelPicker'

interface MessageMetadata {
    usage?: { inputTokens: number, outputTokens: number, totalTokens: number }
}

interface ToolPart {
    type: string
    state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
    toolCallId?: string
    input?: unknown
    output?: unknown
    errorText?: string
}

interface ImageGeneratePart {
    type: string // 'tool-image-generate-primary' | 'tool-image-generate-secondary'
    state: 'input-streaming' | 'input-available' | 'approval-requested' | 'executing' | 'output-available' | 'output-error'
    toolCallId?: string
    input?: { prompt?: string, referenceImageIds?: string[] }
    output?: { imageId?: string, imageIds?: string[] }
    errorText?: string
    approval?: { id: string }
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
                    {part.input?.referenceImageIds && part.input.referenceImageIds.length > 0 && (
                        <p className="text-xs text-base-content/50">
                            参考图：
                            {part.input.referenceImageIds.length}
                            {' '}
                            张
                        </p>
                    )}
                    <div className="flex gap-2 mt-2">
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => part.approval?.id && onApprove(part.approval.id)}
                        >
                            确认
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => part.approval?.id && onDeny(part.approval.id)}
                        >
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
    contextWindow?: number
    imageModels?: ImageModelInfo[]
    primaryImageModelId?: string | null
    primaryImageSize?: string | null
    primaryImageMaxRefs?: number | null
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

export function ChatPage({
    conversationId,
    initialMessages,
    hasLlm,
    contextWindow,
    imageModels = [],
    primaryImageModelId = null,
    primaryImageSize = null,
    primaryImageMaxRefs = null,
    secondaryImageModelId = null,
    secondaryImageSize = null,
}: Props) {
    const [input, setInput] = useState('')
    const [abortedMessageIds, setAbortedMessageIds] = useState<Set<string>>(() => new Set())
    const [uploadedImages, setUploadedImages] = useState<Array<{ id: string, name: string }>>([])
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)

    const { messages, sendMessage, stop, status, error, clearError, addToolApprovalResponse } = useChat<UIMessage<MessageMetadata>>({
        id: conversationId,
        messages: initialMessages,
        transport: new DefaultChatTransport({
            api: '/api/chat',
            prepareSendMessagesRequest: ({ messages }) => ({
                body: { conversationId, messages },
            }),
        }),
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
        onFinish: ({ message, isAbort }) => {
            if (isAbort) {
                setAbortedMessageIds(prev => new Set(prev).add(message.id))
            }
        },
    })

    const maxRefs = primaryImageMaxRefs ?? Infinity
    const atRefLimit = !canUploadMore({ count: uploadedImages.length, max: maxRefs })

    const btnState = getSubmitButtonState({ status, llmSelected: hasLlm, inputEmpty: !input.trim() })
    const gateHint = getGateHint({ llmSelected: hasLlm })

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
            const parts: object[] = [{ type: 'text', text: input }]
            for (const img of uploadedImages) {
                parts.push({ type: 'image-ref', imageId: img.id })
            }
            sendMessage({ parts } as Parameters<typeof sendMessage>[0])
            setInput('')
            setUploadedImages([])
        }
    }

    async function handleFileUpload(files: FileList | null) {
        if (!files || files.length === 0)
            return
        setUploading(true)
        setUploadError(null)
        for (const file of Array.from(files)) {
            const form = new FormData()
            form.append('file', file)
            form.append('conversationId', conversationId)
            try {
                const res = await fetch('/api/images', { method: 'POST', body: form })
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    setUploadError(data.error ?? '上传失败')
                    continue
                }
                const data = await res.json()
                setUploadedImages(prev => [...prev, { id: data.id, name: file.name }])
            }
            catch {
                setUploadError('上传失败')
            }
        }
        setUploading(false)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Escape' && btnState.kind === 'stop') {
            stop()
        }
    }

    return (
        <div className="flex h-dvh flex-col bg-base-100">
            {/* 顶部 Model 选择栏 */}
            <div className="border-b border-base-300 bg-base-200 px-4 py-2">
                <div className="mx-auto flex max-w-2xl flex-wrap items-start gap-4">
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs text-base-content/50">LLM 模型</span>
                        <a href="/settings" className="text-xs text-primary underline truncate">
                            {hasLlm ? '已选择' : '前往设置选择'}
                        </a>
                    </div>
                    <ImageModelPicker
                        conversationId={conversationId}
                        role="IMAGE_PRIMARY"
                        currentModelId={primaryImageModelId}
                        currentSize={primaryImageSize}
                        availableModels={imageModels}
                    />
                    <ImageModelPicker
                        conversationId={conversationId}
                        role="IMAGE_SECONDARY"
                        currentModelId={secondaryImageModelId}
                        currentSize={secondaryImageSize}
                        availableModels={imageModels}
                    />
                </div>
            </div>

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
                            {m.role === 'user'
                                ? (
                                        <div className="rounded-box max-w-prose bg-primary px-4 py-3 text-sm text-primary-content">
                                            {m.parts.map((part, i) => {
                                                const p = part as { type: string, text?: string, imageId?: string }
                                                if (p.type === 'text')
                                                    return <span key={i}>{p.text}</span>
                                                if (p.type === 'image-ref' && p.imageId) {
                                                    return (
                                                        <img
                                                            key={i}
                                                            src={`/api/images/${p.imageId}`}
                                                            loading="lazy"
                                                            className="mt-1 max-h-24 rounded object-contain"
                                                            alt="参考图"
                                                        />
                                                    )
                                                }
                                                return null
                                            })}
                                        </div>
                                    )
                                : (
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
                    {uploadError && (
                        <div className="alert alert-error mb-2 py-1 text-xs">{uploadError}</div>
                    )}
                    {/* 已上传图片 chips */}
                    {uploadedImages.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                            {uploadedImages.map(img => (
                                <span key={img.id} className="badge badge-outline gap-1 text-xs">
                                    <img src={`/api/images/${img.id}`} className="h-4 w-4 rounded object-cover" alt="" />
                                    {img.name}
                                    <button
                                        type="button"
                                        className="ml-0.5 opacity-60 hover:opacity-100"
                                        onClick={() => setUploadedImages(prev => prev.filter(x => x.id !== img.id))}
                                    >
                                        ✕
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        {/* 上传按钮 */}
                        <label
                            className={cn(
                                'btn btn-sm btn-outline px-2',
                                (atRefLimit || !hasLlm) && 'btn-disabled opacity-40 cursor-not-allowed',
                            )}
                            title={atRefLimit ? `已达参考图上限 ${maxRefs} 张` : '添加参考图'}
                        >
                            {uploading ? <span className="loading loading-spinner loading-xs" /> : '+'}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                hidden
                                disabled={atRefLimit || !hasLlm}
                                onChange={e => handleFileUpload(e.target.files)}
                            />
                        </label>
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
