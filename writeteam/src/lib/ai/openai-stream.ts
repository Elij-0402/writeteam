import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"
import { getModel } from "@/lib/ai/model-registry"
import { SupabaseClient } from "@supabase/supabase-js"

interface OpenAIStreamOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  maxTokens: number
  temperature: number
  modelId?: string // optional model override
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
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: "OpenAI API Key 未配置" }, { status: 500 })
  }

  const model = getModel(options.modelId || "gpt-4o-mini")

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.apiModel,
      messages: options.messages,
      stream: true,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return Response.json({ error: `OpenAI error: ${error}` }, { status: 500 })
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
          model: model.apiModel,
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
