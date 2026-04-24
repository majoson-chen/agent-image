import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import * as React from 'react'
import { cn } from '../lib/cn'
import './globals.css'

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
                    'min-h-dvh bg-base-100 font-sans text-base-content antialiased',
                )}
            >
                {children}
            </body>
        </html>
    )
}
