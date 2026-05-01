import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { LanguageModel, OnStepFinishEvent, PrepareStepFunction, ToolSet } from 'ai'
import { ToolLoopAgent } from 'ai'
import 'server-only'

interface BuildAgentOptions {
    model: LanguageModel
    tools: ToolSet
    instructions: string
    onStepFinish: (event: OnStepFinishEvent<ToolSet>) => Promise<void> | void
    prepareStep?: PrepareStepFunction<ToolSet>
    providerOptions?: ProviderOptions
}

export function buildAgent({ model, tools, instructions, onStepFinish, prepareStep, providerOptions }: BuildAgentOptions) {
    return new ToolLoopAgent({
        model,
        instructions,
        tools,
        onStepFinish,
        ...(prepareStep ? { prepareStep } : {}),
        ...(providerOptions ? { providerOptions } : {}),
    })
}
