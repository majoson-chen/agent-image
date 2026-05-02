import { readFileSync } from 'node:fs'

import { join } from 'node:path'
import Mustache from 'mustache'
import 'server-only'

let cachedTemplate: string | null = null

function loadTemplate(): string {
    if (cachedTemplate !== null)
        return cachedTemplate
    const path = join(process.cwd(), 'lib/ai/prompts/system.mustache.txt')
    cachedTemplate = readFileSync(path, 'utf8')
    return cachedTemplate
}

export function buildSystemPrompt(availableTools: string[]): string {
    const hasPrimary = availableTools.includes('image-generate-primary')
    const hasSecondary = availableTools.includes('image-generate-secondary')

    const toolList = availableTools.length > 0
        ? availableTools.map(t => `  - ${t}`).join('\n')
        : '  （当前无任何可用工具。）'

    const template = loadTemplate()
    return Mustache.render(template, {
        toolList,
        hasPrimary,
        hasSecondary,
    })
}
