export default function Page() {
    return (
        <main className="p-8">
            <h1 className="text-xl font-semibold text-base-content">agent-image</h1>
            <p className="mt-2 max-w-prose text-base-content/70">
                主题与语义色由
                {' '}
                <code className="font-mono text-sm text-primary">daisyUI</code>
                {' '}
                与
                {' '}
                <code className="font-mono text-sm text-primary">docs/design-language.md</code>
                {' '}
                约定；当前使用内置
                {' '}
                <code className="font-mono text-sm text-primary">light</code>
                /
                <code className="font-mono text-sm text-primary">dark</code>
                ，未自定义
                {' '}
                <code className="font-mono text-sm text-primary">@plugin &quot;daisyui/theme&quot;</code>
                。
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-primary">
                    primary
                </button>
                <span className="rounded-box bg-base-200 px-3 py-1.5 text-base-content/80 ring-1 ring-base-300">
                    base-200
                </span>
                <span className="badge badge-error font-mono text-sm">error</span>
                <span className="badge badge-success font-mono text-sm">success</span>
            </div>
        </main>
    )
}
