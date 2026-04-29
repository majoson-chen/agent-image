import 'server-only'
import type { LanguageModel, ToolSet, OnStepFinishEvent } from 'ai'
import { ToolLoopAgent, stepCountIs } from 'ai'

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
