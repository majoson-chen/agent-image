export function calcUsagePercent(
    totalTokens: number | null,
    contextWindow: number,
): number {
    if (!totalTokens || !contextWindow)
        return 0
    return Math.min(100, Math.round((totalTokens / contextWindow) * 100))
}

export function formatUsage(tokens: number | null): string {
    if (tokens === null)
        return '0'
    if (tokens >= 1000)
        return `${Math.round(tokens / 1000)}k`
    return String(tokens)
}
