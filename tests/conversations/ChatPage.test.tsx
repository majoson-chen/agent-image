/**
 * U8 — ChatPage 组件测试（test-first）
 * @vitest-environment jsdom
 * 覆盖 approval 状态与生图输出
 */
import type { UIMessage } from 'ai'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatPage } from '@/conversations/[id]/ChatPage'

const mockChat = vi.hoisted(() => ({
    messages: [] as UIMessage[],
}))

// mock @ai-sdk/react useChat
const mockAddToolApprovalResponse = vi.fn()
const mockSendMessage = vi.fn()
const mockStop = vi.fn()
const mockClearError = vi.fn()

vi.mock('@ai-sdk/react', () => ({
    useChat: () => ({
        messages: mockChat.messages,
        sendMessage: mockSendMessage,
        stop: mockStop,
        status: 'ready',
        error: null,
        clearError: mockClearError,
        addToolApprovalResponse: mockAddToolApprovalResponse,
    }),
}))

// mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
}))

// mock composer slots to avoid server-action / dialog issues
vi.mock('../../app/conversations/[id]/ComposerImageSlot', () => ({
    ComposerImageSlot: () => <div data-testid="composer-image-slot" />,
}))

vi.mock('../../app/conversations/[id]/ComposerLlmSlot', () => ({
    ComposerLlmSlot: () => <div data-testid="composer-llm-slot" />,
}))

vi.mock('../../app/conversations/[id]/ComposerAttachments', () => ({
    ComposerAttachments: () => <div data-testid="composer-attachments" />,
}))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    mockChat.messages.length = 0
})

function renderChatPage(overrides: Partial<React.ComponentProps<typeof ChatPage>> = {}) {
    const defaultProps: React.ComponentProps<typeof ChatPage> = {
        conversationId: 'conv-1',
        initialMessages: [],
        hasLlm: true,
        llmModels: [{ id: 'm1', name: 'test-llm', capabilities: null }],
        llmThinkingEnabled: false,
        llmModelId: 'm1',
        ...overrides,
    }
    return render(<ChatPage {...defaultProps} />)
}

describe('chatPage - approval-requested state', () => {
    it('renders confirm and deny buttons when tool state is approval-requested', () => {
        mockChat.messages = [
            {
                id: 'msg-1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-image-generate-primary',
                        state: 'approval-requested',
                        toolCallId: 'call-1',
                        input: { prompt: 'A cute corgi' },
                        approval: { id: 'approval-1' },
                    } as unknown as UIMessage['parts'][number],
                ],
            } as UIMessage,
        ]

        renderChatPage()

        expect(screen.getByRole('button', { name: '确认' })).toBeDefined()
        expect(screen.getByRole('button', { name: '拒绝' })).toBeDefined()
        expect(screen.getByText(/A cute corgi/)).toBeDefined()
    })

    it('calls addToolApprovalResponse with approved=true on 确认 click', () => {
        mockChat.messages = [
            {
                id: 'msg-1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-image-generate-primary',
                        state: 'approval-requested',
                        toolCallId: 'call-1',
                        input: { prompt: 'test' },
                        approval: { id: 'approval-abc' },
                    } as unknown as UIMessage['parts'][number],
                ],
            } as UIMessage,
        ]

        renderChatPage()
        fireEvent.click(screen.getByRole('button', { name: '确认' }))

        expect(mockAddToolApprovalResponse).toHaveBeenCalledWith({ id: 'approval-abc', approved: true })
    })

    it('calls addToolApprovalResponse with approved=false on 拒绝 click', () => {
        mockChat.messages = [
            {
                id: 'msg-1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-image-generate-primary',
                        state: 'approval-requested',
                        toolCallId: 'call-1',
                        input: { prompt: 'test' },
                        approval: { id: 'approval-xyz' },
                    } as unknown as UIMessage['parts'][number],
                ],
            } as UIMessage,
        ]

        renderChatPage()
        fireEvent.click(screen.getByRole('button', { name: '拒绝' }))

        expect(mockAddToolApprovalResponse).toHaveBeenCalledWith({ id: 'approval-xyz', approved: false })
    })
})

describe('chatPage - output-available state', () => {
    it('renders img tag with /api/images/:id when output-available', () => {
        mockChat.messages = [
            {
                id: 'msg-1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-image-generate-primary',
                        state: 'output-available',
                        toolCallId: 'call-1',
                        input: { prompt: 'test' },
                        output: { imageId: 'img-123' },
                    } as unknown as UIMessage['parts'][number],
                ],
            } as UIMessage,
        ]

        renderChatPage()
        const img = document.querySelector('img[src="/api/images/img-123"]')
        expect(img).not.toBeNull()
    })
})

describe('chatPage - executing state', () => {
    it('shows 生成中 spinner when executing', () => {
        mockChat.messages = [
            {
                id: 'msg-1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-image-generate-primary',
                        state: 'executing',
                        toolCallId: 'call-1',
                        input: { prompt: 'test' },
                    } as unknown as UIMessage['parts'][number],
                ],
            } as UIMessage,
        ]

        renderChatPage()
        expect(screen.getByText('生成中…')).toBeDefined()
    })
})
