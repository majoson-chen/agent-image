/**
 * U8 — ChatPage 组件测试（test-first）
 * 覆盖 approval 状态、上传 UI、image-ref 渲染
 */
import type { UIMessage } from 'ai'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// mock @ai-sdk/react useChat
const mockAddToolApprovalResponse = vi.fn()
const mockSendMessage = vi.fn()
const mockStop = vi.fn()
const mockClearError = vi.fn()

vi.mock('@ai-sdk/react', () => ({
    useChat: () => ({
        messages: mockMessages,
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

// mock ImageModelPicker to avoid server-action issues
vi.mock('../../app/conversations/[id]/ImageModelPicker', () => ({
    ImageModelPicker: () => <div data-testid="image-model-picker" />,
}))

let mockMessages: UIMessage[] = []

import { ChatPage } from '../../app/conversations/[id]/ChatPage'

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    mockMessages = []
})

function renderChatPage(overrides: Partial<React.ComponentProps<typeof ChatPage>> = {}) {
    const defaultProps: React.ComponentProps<typeof ChatPage> = {
        conversationId: 'conv-1',
        initialMessages: [],
        hasLlm: true,
        ...overrides,
    }
    return render(<ChatPage {...defaultProps} />)
}

describe('ChatPage - approval-requested state', () => {
    it('renders confirm and deny buttons when tool state is approval-requested', () => {
        mockMessages = [
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
        mockMessages = [
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
        mockMessages = [
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

describe('ChatPage - output-available state', () => {
    it('renders img tag with /api/images/:id when output-available', () => {
        mockMessages = [
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

describe('ChatPage - image-ref in user message', () => {
    it('renders img with /api/images/:id for image-ref parts', () => {
        mockMessages = [
            {
                id: 'msg-1',
                role: 'user',
                parts: [
                    { type: 'text', text: 'see this image' },
                    { type: 'image-ref', imageId: 'ref-img-001' } as unknown as UIMessage['parts'][number],
                ],
            } as UIMessage,
        ]

        renderChatPage()
        const img = document.querySelector('img[src="/api/images/ref-img-001"]')
        expect(img).not.toBeNull()
    })
})

describe('ChatPage - upload UI', () => {
    it('renders + button for file upload', () => {
        renderChatPage({ hasLlm: true })
        // + 号按钮（label 包含 input[type=file]）
        const fileInput = document.querySelector('input[type="file"]')
        expect(fileInput).not.toBeNull()
    })

    it('upload + button is disabled when at ref limit', () => {
        // maxRefs=2, uploadedImages已经2张（通过模拟达到上限）
        // 由于 state 初始为空，直接测试 maxRefs=0 时 + 号 disabled
        renderChatPage({
            hasLlm: true,
            primaryImageMaxRefs: 0,
        })
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        expect(fileInput?.disabled).toBe(true)
    })

    it('upload + button not disabled when maxRefs not reached', () => {
        renderChatPage({
            hasLlm: true,
            primaryImageMaxRefs: 14,
        })
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        expect(fileInput?.disabled).toBe(false)
    })
})

describe('ChatPage - executing state', () => {
    it('shows 生成中 spinner when executing', () => {
        mockMessages = [
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
