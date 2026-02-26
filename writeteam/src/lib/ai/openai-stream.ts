import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"
import { SupabaseClient } from "@supabase/supabase-js"

interface OpenAIStreamOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  maxTokens: number
  temperature: number
  baseUrl: string
  apiKey: string
  modelId: string
}

interface TelemetryOptions {
  supabase: SupabaseClient
  userId: string
  projectId: string
  documentId: string | null
  feature: string
  promptLog: string
}

export async function createOpenAIStreamResponse(
  options: OpenAIStreamOptions,
  telemetry: TelemetryOptions
): Promise<Response> {
  const startedAt = Date.now()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`
  }

  const url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: options.modelId,
      messages: options.messages,
      stream: true,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return Response.json({ error: `AI API 错误: ${error}` }, { status: 500 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }
      const decoder = new TextDecoder()
      let fullText = ""
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "))
          for (const line of lines) {
            const data = line.slice(6)
            if (data === "[DONE]") continue
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullText += content
                controller.enqueue(encoder.encode(content))
              }
            } catch { /* skip */ }
          }
        }
      } finally {
        await telemetry.supabase.from("ai_history").insert({
          user_id: telemetry.userId,
          project_id: telemetry.projectId,
          document_id: telemetry.documentId,
          feature: telemetry.feature,
          prompt: telemetry.promptLog,
          result: fullText,
          model: options.modelId,
          tokens_used: estimateTokenCount(fullText),
          latency_ms: Date.now() - startedAt,
          output_chars: fullText.length,
          response_fingerprint: createTextFingerprint(fullText),
        })
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
