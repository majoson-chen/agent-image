import { Suspense } from 'react'
import { listModels } from '../../lib/db/models'
import { getAllBindings } from '../../lib/db/search-tool-bindings'
import prisma from '../../lib/prisma'
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
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-semibold text-base-content">设置</h1>

            <section className="mb-8">
                <h2 className="mb-4 text-lg font-medium text-base-content">LLM 模型</h2>
                <Suspense fallback={<span className="loading loading-spinner" />}>
                    <LlmModelList />
                </Suspense>
            </section>

            <div className="divider" />

            <section className="mb-8">
                <h2 className="mb-4 text-lg font-medium text-base-content">Search 模型</h2>
                <Suspense fallback={<span className="loading loading-spinner" />}>
                    <SearchModelList />
                </Suspense>
            </section>

            <div className="divider" />

            <section className="mb-8">
                <h2 className="mb-4 text-lg font-medium text-base-content">生图模型</h2>
                <p className="mb-4 text-sm text-base-content/60">
                    配置火山方舟 Seedream 生图模型，含支持的分辨率与参考图上限。
                </p>
                <Suspense fallback={<span className="loading loading-spinner" />}>
                    <ImageModelList />
                </Suspense>
            </section>

            <div className="divider" />

            <section>
                <h2 className="mb-4 text-lg font-medium text-base-content">工具绑定</h2>
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
    )
}
