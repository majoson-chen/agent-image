'use client'

import { cn } from '../../../lib/cn'
import { calcUsagePercent, formatUsage } from '../../../lib/usage-calc'

interface Props {
    totalTokens: number | null
    contextWindow: number
}

export function ContextUsageBar({ totalTokens, contextWindow }: Props) {
    const percent = calcUsagePercent(totalTokens, contextWindow)

    return (
        <div className="flex items-center gap-2 text-xs text-base-content/50">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-base-300">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-500',
                        percent >= 90 ? 'bg-error' : percent >= 70 ? 'bg-warning' : 'bg-primary',
                    )}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span>
                {formatUsage(totalTokens)}
                {' / '}
                {formatUsage(contextWindow)}
            </span>
        </div>
    )
}
