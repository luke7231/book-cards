import { gateway } from '@ai-sdk/gateway'
import { generateText } from 'ai'
import { Output } from 'ai'
import { insightSchema, cardSchema, type InsightOutput, type CardOutput } from './schema'
import { SYSTEM_PROMPT, buildUserPrompt, buildRegeneratePrompt } from './prompts'

const MODEL = 'anthropic/claude-opus-4.6'

export async function generateInsights(bookTitle: string): Promise<InsightOutput> {
  const { experimental_output } = await generateText({
    model: gateway(MODEL),
    output: Output.object({ schema: insightSchema }),
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(bookTitle),
  })
  return experimental_output as InsightOutput
}

export async function regenerateSingleCard(
  bookTitle: string,
  cardNumber: number,
  currentTitle: string,
  currentBody: string
): Promise<CardOutput> {
  const { experimental_output } = await generateText({
    model: gateway(MODEL),
    output: Output.object({ schema: cardSchema }),
    system: SYSTEM_PROMPT,
    prompt: buildRegeneratePrompt(bookTitle, cardNumber, currentTitle, currentBody),
  })
  return experimental_output as CardOutput
}
