'use client'

import { cn } from '@lib/cn'
import { calcUsagePercent, formatUsage } from '@lib/usage-calc'

interface Props {
    totalTokens: number | null
    contextWindow: number
}

/**
 * R6 / 设计稿：本对话 LLM 上下文用量为圆环，外径贴近旁侧控件行高；默认无数字；
 * hover 用 daisyUI `tooltip` + `data-tip` 展示详情（原生 `title` 在 SVG transform 等场景易不弹出）。
 * 尚无可信累计（totalTokens == null）时不占位（设计稿「无数据帧」）。
 */
export function ContextUsageBar({ totalTokens, contextWindow }: Props) {
    if (totalTokens === null)
        return null

    const percent = calcUsagePercent(totalTokens, contextWindow)
    const size = 22
    const stroke = 2.5
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    const filled = (percent / 100) * c

    const strokeColor = percent >= 90 ? 'stroke-error' : percent >= 70 ? 'stroke-warning' : 'stroke-primary'
    const tip = `${percent}% | ${formatUsage(totalTokens)} / ${formatUsage(contextWindow)}`

    return (
        <div
            className="tooltip tooltip-top tooltip-neutral flex max-w-full shrink-0 items-end pb-0.5"
            data-tip={tip}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="block -rotate-90 cursor-help"
                aria-label={tip}
                role="img"
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    className="stroke-base-300"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    className={cn('transition-[stroke-dasharray] duration-500', strokeColor)}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${c}`}
                />
            </svg>
        </div>
    )
}
