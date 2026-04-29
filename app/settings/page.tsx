import { Suspense } from 'react'
import { LlmModelList } from './LlmModelList'

export const metadata = { title: '设置 — agent-image' }

export default function SettingsPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-semibold text-base-content">设置</h1>
            <section>
                <h2 className="mb-4 text-lg font-medium text-base-content">LLM 模型</h2>
                <Suspense fallback={<span className="loading loading-spinner" />}>
                    <LlmModelList />
                </Suspense>
            </section>
        </main>
    )
}
