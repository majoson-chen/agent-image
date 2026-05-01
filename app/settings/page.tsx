import { listModels } from '@lib/db/models'
import { getAllBindings } from '@lib/db/search-tool-bindings'
import prisma from '@lib/prisma'
import { Bot, Images, Link2, Search, SlidersHorizontal } from 'lucide-react'
import { Suspense } from 'react'
import { ImageModelList } from './ImageModelList'
import { LlmModelList } from './LlmModelList'
import { SearchModelList } from './SearchModelList'
import { SearchToolBindingForm } from './SearchToolBindingForm'

export const metadata = { title: '设置 — agent-image' }

export default async function SettingsPage() {
    const [searchModels, bindings] = await Promise.all([
        listModels(prisma, 'SEARCH'),
        getAllBindings(prisma),
    ])

    return (
        <div className="min-h-0 flex-1 overflow-y-auto">
            <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-base-content">
                <SlidersHorizontal className="size-8 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                设置
            </h1>

            <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-base-content">
                    <Bot className="size-5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                    LLM 模型
                </h2>
                <Suspense fallback={<span className="loading loading-spinner" />}>
                    <LlmModelList />
                </Suspense>
            </section>

            <div className="divider" />

            <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-base-content">
                    <Search className="size-5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                    Search 模型
                </h2>
                <Suspense fallback={<span className="loading loading-spinner" />}>
                    <SearchModelList />
                </Suspense>
            </section>

            <div className="divider" />

            <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-base-content">
                    <Images className="size-5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                    生图模型
                </h2>
                <p className="mb-4 text-sm text-base-content/60">
                    为对话中的「主生图 / 次生图」配置图像生成后端。支持火山方舟 Seedream
                    与阿里云百炼万相图像（DashScope）：分别填写 API Key、可选网关地址，
                    以及本机可选分辨率（决定对话里可切换的尺寸）。
                    本应用仅接入图像同步接口，不包含视频生成。
                </p>
                <Suspense fallback={<span className="loading loading-spinner" />}>
                    <ImageModelList />
                </Suspense>
            </section>

            <div className="divider" />

            <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-base-content">
                    <Link2 className="size-5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                    工具绑定
                </h2>
                <p className="mb-4 text-sm text-base-content/60">
                    指定各工具使用哪条 Search 模型。未绑定时 Agent 不持有该工具。
                </p>
                <SearchToolBindingForm
                    searchModels={searchModels}
                    currentWebSearch={bindings.WEB_SEARCH ?? null}
                    currentImageSearch={bindings.IMAGE_SEARCH ?? null}
                />
            </section>
            </main>
        </div>
    )
}
