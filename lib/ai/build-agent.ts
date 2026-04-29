import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { LanguageModel, OnStepFinishEvent, ToolSet } from 'ai'
import { stepCountIs, ToolLoopAgent } from 'ai'
import 'server-only'

interface BuildAgentOptions {
    model: LanguageModel
    tools: ToolSet
    instructions: string
    onStepFinish: (event: OnStepFinishEvent<ToolSet>) => Promise<void> | void
    providerOptions?: ProviderOptions
}

export function buildAgent({ model, tools, instructions, onStepFinish, providerOptions }: BuildAgentOptions) {
    return new ToolLoopAgent({
        model,
        instructions,
        tools,
        onStepFinish,
        ...(providerOptions ? { providerOptions } : {}),
    })
}
