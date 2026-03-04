import { generateText } from "ai"
import { createBYOKProvider } from "@/lib/ai/ai-provider"

/**
 * Non-streaming OpenAI-compatible JSON call.
 * Used by saliency, canvas-generate, and visualize routes.
 *
 * Migrated from raw fetch to AI SDK generateText().
 * External interface unchanged — callers need no modifications.
 */
export async function callOpenAIJson(options: {
  baseUrl: string
  apiKey: string
  modelId: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  maxTokens: number
  temperature: number
}): Promise<{ content: string; error?: string }> {
  try {
    const model = createBYOKProvider({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      modelId: options.modelId,
    })

    const result = await generateText({
      model,
      messages: options.messages,
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature,
    })

    return { content: result.text }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { content: "", error: `AI API 错误: ${message}` }
  }
}
