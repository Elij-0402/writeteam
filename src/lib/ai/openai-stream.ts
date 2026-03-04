import { streamText } from "ai"
import { createBYOKProvider } from "@/lib/ai/ai-provider"
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

// ---------------------------------------------------------------------------
// Telemetry helper — reduces duplication between error and success paths
// ---------------------------------------------------------------------------

interface TelemetryRecord {
  userId: string
  projectId: string
  documentId: string | null
  provider: string
  feature: string
  promptLog: string
  result: string
  modelId: string
  latencyMs: number
  errorType: string | null
  errorMessage: string | null
  isRetry: boolean
  recoveryStatus: string
  attemptedModel: string | null
}

async function writeTelemetry(
  supabase: SupabaseClient,
  record: TelemetryRecord,
): Promise<void> {
  await supabase.from("ai_history").insert({
    user_id: record.userId,
    project_id: record.projectId,
    document_id: record.documentId,
    provider: record.provider,
    feature: record.feature,
    prompt: record.promptLog,
    result: record.result,
    model: record.modelId,
    tokens_used: record.result ? estimateTokenCount(record.result) : undefined,
    latency_ms: record.latencyMs,
    output_chars: record.result.length,
    response_fingerprint: record.result ? createTextFingerprint(record.result) : null,
    error_type: record.errorType,
    error_message: record.errorMessage,
    is_retry: record.isRetry,
    recovery_status: record.recoveryStatus,
    attempted_model: record.attemptedModel,
  })
}

// ---------------------------------------------------------------------------
// Main streaming function
// ---------------------------------------------------------------------------

export async function createOpenAIStreamResponse(
  options: OpenAIStreamOptions,
  telemetry: TelemetryOptions,
): Promise<Response> {
  const startedAt = Date.now()
  const provider = resolveProviderNameByBaseUrl(options.baseUrl)

  // Create BYOK model via AI SDK
  let result: ReturnType<typeof streamText>
  try {
    const model = createBYOKProvider({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      modelId: options.modelId,
    })

    result = streamText({
      model,
      messages: options.messages,
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature,
    })
  } catch (initError) {
    // streamText initialization error (model not found, config invalid, etc.)
    const classification = classifyAIError(null, initError, "ai-stream")

    await writeTelemetry(telemetry.supabase, {
      userId: telemetry.userId,
      projectId: telemetry.projectId,
      documentId: telemetry.documentId,
      provider,
      feature: telemetry.feature,
      promptLog: telemetry.promptLog,
      result: "",
      modelId: options.modelId,
      latencyMs: Date.now() - startedAt,
      errorType: classification.errorType,
      errorMessage: classification.message,
      isRetry: telemetry.isRetry ?? false,
      recoveryStatus: "failure",
      attemptedModel: telemetry.attemptedModel ?? null,
    })

    return Response.json(
      {
        error: classification.message,
        errorType: classification.errorType,
        retriable: classification.retriable,
        suggestedActions: classification.suggestedActions,
      },
      { status: 502 },
    )
  }

  // Build streaming Response via ReadableStream
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let fullText = ""
      let streamError = false

      try {
        for await (const chunk of result.textStream) {
          fullText += chunk
          controller.enqueue(encoder.encode(chunk))
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

        await writeTelemetry(telemetry.supabase, {
          userId: telemetry.userId,
          projectId: telemetry.projectId,
          documentId: telemetry.documentId,
          provider,
          feature: telemetry.feature,
          promptLog: telemetry.promptLog,
          result: fullText,
          modelId: options.modelId,
          latencyMs: Date.now() - startedAt,
          errorType: streamError ? "network" : null,
          errorMessage: streamError ? "流式传输中断" : null,
          isRetry: telemetry.isRetry ?? false,
          recoveryStatus,
          attemptedModel: telemetry.attemptedModel ?? null,
        })
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
