export type ErrorContext = "connection-test" | "model-list" | "ai-stream"

// --- Story 1.4: Structured error classification ---

export type AIErrorType =
  | "auth"
  | "model_not_found"
  | "rate_limit"
  | "timeout"
  | "provider_unavailable"
  | "server_error"
  | "network"
  | "format_incompatible"
  | "unknown"

export type RecoveryAction = "retry" | "switch_model" | "check_config" | "wait_and_retry"

export interface ErrorClassification {
  errorType: AIErrorType
  message: string
  retriable: boolean
  suggestedActions: RecoveryAction[]
  severity: "low" | "medium" | "high"
}

/**
 * Unified AI error classification entry point.
 * Classifies both HTTP status errors and network/runtime errors
 * into a structured ErrorClassification.
 */
export function classifyAIError(
  status: number | null,
  error: unknown,
  context: ErrorContext
): ErrorClassification {
  // HTTP status-based classification
  if (status !== null && status > 0) {
    return classifyHttpStatusError(status, context)
  }

  // Network/runtime error classification
  return classifyRuntimeError(error)
}

function classifyHttpStatusError(status: number, context: ErrorContext): ErrorClassification {
  if (status === 401 || status === 403) {
    return {
      errorType: "auth",
      message: "认证失败，请检查 API Key 是否有效。",
      retriable: false,
      suggestedActions: ["check_config", "switch_model"],
      severity: "high",
    }
  }

  if (status === 404) {
    const message =
      context === "connection-test"
        ? "模型不存在，请检查模型 ID 是否正确。"
        : context === "model-list"
          ? "模型列表端点不存在，请检查 Base URL 是否正确。"
          : "请求的资源不存在，请检查配置是否正确。"
    return {
      errorType: "model_not_found",
      message,
      retriable: false,
      suggestedActions: ["switch_model", "check_config"],
      severity: "high",
    }
  }

  if (status === 429) {
    return {
      errorType: "rate_limit",
      message: "请求频率过高，请稍后重试。",
      retriable: true,
      suggestedActions: ["wait_and_retry", "switch_model"],
      severity: "low",
    }
  }

  if (status === 422 || status === 400) {
    return {
      errorType: "format_incompatible",
      message: "请求格式不兼容，模型可能不支持当前参数。",
      retriable: false,
      suggestedActions: ["switch_model", "check_config"],
      severity: "medium",
    }
  }

  if (status >= 500) {
    return {
      errorType: "server_error",
      message: "AI 服务暂时不可用，请稍后重试或更换 Provider。",
      retriable: true,
      suggestedActions: ["retry", "switch_model"],
      severity: "low",
    }
  }

  return {
    errorType: "unknown",
    message: "AI 请求失败，请检查配置是否正确。",
    retriable: true,
    suggestedActions: ["retry", "check_config"],
    severity: "medium",
  }
}

// NOTE: This is the SERVER-SIDE (Node.js) error classifier.
// The client-side counterpart is parseFetchError() in parse-ai-error.ts.
// Error message patterns differ between Node.js and browser environments.
function classifyRuntimeError(error: unknown): ErrorClassification {
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

  if (
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("fetch failed")
  ) {
    return {
      errorType: "provider_unavailable",
      message: "无法连接到 AI 服务，请检查 Base URL 是否正确。",
      retriable: true,
      suggestedActions: ["retry", "check_config", "switch_model"],
      severity: "medium",
    }
  }

  return {
    errorType: "network",
    message: "网络异常，请检查网络连接并重试。",
    retriable: true,
    suggestedActions: ["retry", "check_config"],
    severity: "medium",
  }
}

// --- Legacy functions (preserved for backward compatibility with connection-test/model-list) ---

export function classifyHttpError(status: number, context: ErrorContext): string {
  return classifyAIError(status, null, context).message
}

export function classifyNetworkError(error: unknown): string {
  return classifyAIError(null, error, "ai-stream").message
}

/** Default fetch timeout in milliseconds for non-streaming requests */
export const AI_FETCH_TIMEOUT_MS = 15_000
