import Link from 'next/link'
import { listConversations } from '../lib/db/conversations'
import prisma from '../lib/prisma'
import { NewConversationButton } from './NewConversationButton'

export async function Sidebar() {
    const conversations = await listConversations(prisma)

    return (
        <aside className="flex h-dvh w-60 flex-none flex-col border-r border-base-300 bg-base-200">
            <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
                <span className="font-semibold text-base-content">对话</span>
                <NewConversationButton />
            </div>

            <nav className="flex-1 overflow-y-auto py-2">
                {conversations.length === 0 && (
                    <p className="px-4 py-3 text-sm text-base-content/40">暂无对话</p>
                )}
                {conversations.map(c => (
                    <Link
                        key={c.id}
                        href={`/conversations/${c.id}`}
                        className="block truncate px-4 py-2.5 text-sm text-base-content hover:bg-base-300"
                    >
                        {c.title ?? '新对话'}
                    </Link>
                ))}
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
