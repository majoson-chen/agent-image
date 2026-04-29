import type { LanguageModel, OnStepFinishEvent, ToolSet } from 'ai'
import { stepCountIs, ToolLoopAgent } from 'ai'
import 'server-only'

interface BuildAgentOptions {
    model: LanguageModel
    tools: ToolSet
    instructions: string
    onStepFinish: (event: OnStepFinishEvent<ToolSet>) => Promise<void> | void
}

export function buildAgent({ model, tools, instructions, onStepFinish }: BuildAgentOptions) {
    return new ToolLoopAgent({
        model,
        instructions,
        tools,
        stopWhen: stepCountIs(20),
        onStepFinish,
    })
}
