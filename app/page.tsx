import { redirect } from 'next/navigation'
import { getMostRecent } from '../lib/db/conversations'
import prisma from '../lib/prisma'

export default async function Page() {
    const recent = await getMostRecent(prisma)
    if (recent)
        redirect(`/conversations/${recent.id}`)

    // 无对话时显示引导
    return (
        <div className="flex h-full items-center justify-center">
            <div className="text-center">
                <p className="text-base-content/50">点击左侧「+」新建对话</p>
            </div>
        </div>
    )
}
