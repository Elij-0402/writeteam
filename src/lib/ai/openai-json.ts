/**
 * Non-streaming OpenAI-compatible JSON call.
 * Used by canvas-generate, saliency, and visualize routes.
 */
export async function callOpenAIJson(options: {
  baseUrl: string
  apiKey: string
  modelId: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  maxTokens: number
  temperature: number
}): Promise<{ content: string; error?: string }> {
  const { baseUrl, apiKey, modelId, messages, maxTokens, temperature } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { content: "", error: `AI API 错误: ${error}` }
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ""
  return { content }
}
