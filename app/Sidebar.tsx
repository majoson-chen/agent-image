import Link from 'next/link'
import { listConversations } from '../lib/db/conversations'
import prisma from '../lib/prisma'
import { ConversationSidebarNav } from './ConversationSidebarNav'
import { NewConversationButton } from './NewConversationButton'

export async function Sidebar() {
    const conversations = await listConversations(prisma)

    return (
        <aside className="flex h-dvh w-60 flex-none flex-col border-r border-base-300 bg-base-200">
            <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
                <span className="font-semibold text-base-content">对话</span>
                <NewConversationButton />
            </div>

            <nav className="flex-1 overflow-y-auto px-1 py-2">
                {conversations.length === 0
                    ? (
                            <p className="px-3 py-3 text-sm text-base-content/40">暂无对话</p>
                        )
                    : (
                            <ConversationSidebarNav
                                conversations={conversations.map(c => ({ id: c.id, title: c.title }))}
                            />
                        )}
            </nav>

            <div className="border-t border-base-300 px-4 py-3">
                <Link
                    href="/settings"
                    className="block text-sm text-base-content/60 hover:text-base-content"
                >
                    设置
                </Link>
            </div>
        </aside>
    )
}
