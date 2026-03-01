import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"
import { classifyAIError } from "@/lib/ai/error-classification"
import { resolveProviderNameByBaseUrl } from "@/lib/ai/ai-config"
import type { SupabaseClient } from "@supabase/supabase-js"

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
  isRetry?: boolean
  attemptedModel?: string
  recoveryType?: "retry" | "switch"
}

/**
 * Extract retry/recovery metadata from API request body.
 * Client injects _isRetry, _attemptedModel, _recoveryType when retrying via RecoveryActionBar.
 */
export function extractRetryMeta(body: Record<string, unknown>): {
  isRetry?: boolean
  attemptedModel?: string
  recoveryType?: "retry" | "switch"
} {
  const meta: { isRetry?: boolean; attemptedModel?: string; recoveryType?: "retry" | "switch" } = {}
  if (body._isRetry === true) meta.isRetry = true
  if (typeof body._attemptedModel === "string") meta.attemptedModel = body._attemptedModel
  if (body._recoveryType === "retry" || body._recoveryType === "switch") meta.recoveryType = body._recoveryType
  return meta
}

export async function createOpenAIStreamResponse(
  options: OpenAIStreamOptions,
  telemetry: TelemetryOptions
): Promise<Response> {
  const startedAt = Date.now()
  const provider = resolveProviderNameByBaseUrl(options.baseUrl)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`
  }

  const url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`

  let response: globalThis.Response
  try {
    response = await fetch(url, {
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
  } catch (fetchError) {
    // Network error before response (ECONNREFUSED, timeout, etc.)
    const classification = classifyAIError(null, fetchError, "ai-stream")

    // Write failure telemetry
    await telemetry.supabase.from("ai_history").insert({
      user_id: telemetry.userId,
      project_id: telemetry.projectId,
      document_id: telemetry.documentId,
      provider,
      feature: telemetry.feature,
      prompt: telemetry.promptLog,
      result: "",
      model: options.modelId,
      latency_ms: Date.now() - startedAt,
      output_chars: 0,
      error_type: classification.errorType,
      error_message: classification.message,
      is_retry: telemetry.isRetry ?? false,
      recovery_status: "failure",
      attempted_model: telemetry.attemptedModel ?? null,
    })

    return Response.json(
      {
        error: classification.message,
        errorType: classification.errorType,
        retriable: classification.retriable,
        suggestedActions: classification.suggestedActions,
      },
      { status: 502 }
    )
  }

  if (!response.ok) {
    const classification = classifyAIError(response.status, null, "ai-stream")

    // Write failure telemetry
    await telemetry.supabase.from("ai_history").insert({
      user_id: telemetry.userId,
      project_id: telemetry.projectId,
      document_id: telemetry.documentId,
      provider,
      feature: telemetry.feature,
      prompt: telemetry.promptLog,
      result: "",
      model: options.modelId,
      latency_ms: Date.now() - startedAt,
      output_chars: 0,
      error_type: classification.errorType,
      error_message: classification.message,
      is_retry: telemetry.isRetry ?? false,
      recovery_status: "failure",
      attempted_model: telemetry.attemptedModel ?? null,
    })

    return Response.json(
      {
        error: classification.message,
        errorType: classification.errorType,
        retriable: classification.retriable,
        suggestedActions: classification.suggestedActions,
      },
      { status: response.status }
    )
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
      let streamError = false
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
              // Check for provider-side error events in the stream
              if (parsed.error) {
                streamError = true
                const errorEvent = JSON.stringify({
                  error: typeof parsed.error === "string" ? parsed.error : "流式传输中断",
                  errorType: "server_error",
                  retriable: true,
                  suggestedActions: ["retry", "switch_model"],
                })
                controller.enqueue(encoder.encode(`\n\ndata: ${errorEvent}\n\n`))
                break
              }
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullText += content
                controller.enqueue(encoder.encode(content))
              }
            } catch { /* skip malformed SSE chunks */ }
          }
        }
      } catch {
        // Stream interrupted mid-read
        streamError = true
        const errorEvent = JSON.stringify({
          error: "流式传输中断，请重试。",
          errorType: "network",
          retriable: true,
          suggestedActions: ["retry", "switch_model"],
        })
        controller.enqueue(encoder.encode(`\n\ndata: ${errorEvent}\n\n`))
      } finally {
        const recoveryStatus = streamError
          ? "failure"
          : telemetry.recoveryType === "switch"
            ? "recovered_switch"
            : telemetry.isRetry
              ? "recovered_retry"
              : "success"

        await telemetry.supabase.from("ai_history").insert({
          user_id: telemetry.userId,
          project_id: telemetry.projectId,
          document_id: telemetry.documentId,
          provider,
          feature: telemetry.feature,
          prompt: telemetry.promptLog,
          result: fullText,
          model: options.modelId,
          tokens_used: estimateTokenCount(fullText),
          latency_ms: Date.now() - startedAt,
          output_chars: fullText.length,
          response_fingerprint: fullText ? createTextFingerprint(fullText) : null,
          error_type: streamError ? "network" : null,
          error_message: streamError ? "流式传输中断" : null,
          is_retry: telemetry.isRetry ?? false,
          recovery_status: recoveryStatus,
          attempted_model: telemetry.attemptedModel ?? null,
        })
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
