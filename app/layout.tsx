import { cn } from '@lib/cn'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import * as React from 'react'
import { Sidebar } from './Sidebar'
import './globals.css'

// streamdown：动画 + KaTeX（@streamdown/math 依赖）
import 'streamdown/styles.css'
import 'katex/dist/katex.min.css'

const fontSans = IBM_Plex_Sans({
    subsets: ['latin'],
    variable: '--font-app-sans',
    display: 'swap',
    weight: ['400', '500', '600'],
})

const fontMono = IBM_Plex_Mono({
    subsets: ['latin'],
    variable: '--font-app-mono',
    display: 'swap',
    weight: ['400', '500'],
})

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="zh-CN">
            <body
                className={cn(
                    fontSans.variable,
                    fontMono.variable,
                    'bg-base-100 font-sans text-base-content antialiased',
                )}
            >
                <div className="flex h-dvh">
                    <Sidebar />
                    {/* main 勿用 overflow-y-auto：会裁切子树内 absolute 的 daisy tooltip */}
                    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    )
}
