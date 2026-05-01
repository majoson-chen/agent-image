import { getMostRecent } from '@lib/db/conversations'
import prisma from '@lib/prisma'
import { MessageSquarePlus } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function Page() {
    const recent = await getMostRecent(prisma)
    if (recent)
        redirect(`/conversations/${recent.id}`)

    // 无对话时显示引导
    return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <MessageSquarePlus className="size-14 shrink-0 text-base-content/20" strokeWidth={1.25} aria-hidden />
                <p className="text-sm text-base-content/50">
                    点击左上角的
                    {' '}
                    <span className="tabular-nums">＋</span>
                    {' '}
                    新建对话开始
                </p>
            </div>
        </div>
    )
}
