import type { ErrorClassification, AIErrorType, RecoveryAction } from "@/lib/ai/error-classification"

interface StructuredErrorResponse {
  error: string
  errorType: AIErrorType
  retriable: boolean
  suggestedActions: RecoveryAction[]
}

function isStructuredError(data: unknown): data is StructuredErrorResponse {
  if (typeof data !== "object" || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.error === "string" &&
    typeof obj.errorType === "string" &&
    typeof obj.retriable === "boolean" &&
    Array.isArray(obj.suggestedActions)
  )
}

/**
 * Parse AI endpoint error response into ErrorClassification.
 * Supports both new structured JSON and legacy plain-text error responses.
 */
export async function parseAIError(response: Response): Promise<ErrorClassification> {
  try {
    const data = await response.json()

    // New structured error format (Story 1.4+)
    if (isStructuredError(data)) {
      return {
        errorType: data.errorType,
        message: data.error,
        retriable: data.retriable,
        suggestedActions: data.suggestedActions,
        severity: inferSeverity(data.errorType),
      }
    }

    // Legacy format: { error: "string" }
    if (typeof data.error === "string") {
      return {
        errorType: inferErrorType(data.error, response.status),
        message: data.error,
        retriable: response.status >= 500 || response.status === 429,
        suggestedActions: ["retry", "check_config"],
        severity: response.status >= 500 ? "low" : "medium",
      }
    }
  } catch {
    // Response is not JSON
  }

  // Fallback for non-JSON responses
  return {
    errorType: "unknown",
    message: "AI 请求失败，请检查配置后重试。",
    retriable: true,
    suggestedActions: ["retry", "check_config"],
    severity: "medium",
  }
}

/**
 * Parse a network/fetch error (no response) into ErrorClassification.
 * NOTE: This is the CLIENT-SIDE counterpart of classifyRuntimeError() in error-classification.ts.
 * Browser and Node.js produce different error messages for similar failures:
 * - Browser: "Failed to fetch", "NetworkError" — checked here
 * - Node.js: "fetch failed", "ECONNREFUSED", "ENOTFOUND" — checked in error-classification.ts
 */
export function parseFetchError(error: unknown): ErrorClassification {
  const message = error instanceof Error ? error.message.toLowerCase() : ""

  if (message.includes("timeout") || message.includes("abort")) {
    return {
      errorType: "timeout",
      message: "连接超时，请检查网络连接或更换 Provider。",
      retriable: true,
      suggestedActions: ["retry", "switch_model"],
      severity: "low",
    }
  }

  if (message.includes("failed to fetch") || message.includes("networkerror")) {
    return {
      errorType: "network",
      message: "网络异常，请检查网络连接并重试。",
      retriable: true,
      suggestedActions: ["retry", "check_config"],
      severity: "medium",
    }
  }

  return {
    errorType: "unknown",
    message: error instanceof Error ? error.message : "AI 请求失败",
    retriable: true,
    suggestedActions: ["retry", "check_config"],
    severity: "medium",
  }
}

function inferSeverity(errorType: AIErrorType): "low" | "medium" | "high" {
  switch (errorType) {
    case "auth":
    case "model_not_found":
    case "format_incompatible":
      return "high"
    case "rate_limit":
    case "timeout":
    case "server_error":
      return "low"
    default:
      return "medium"
  }
}

function inferErrorType(message: string, status: number): AIErrorType {
  if (status === 401 || status === 403) return "auth"
  if (status === 404) return "model_not_found"
  if (status === 429) return "rate_limit"
  if (status >= 500) return "server_error"
  if (message.includes("超时")) return "timeout"
  if (message.includes("网络")) return "network"
  return "unknown"
}
