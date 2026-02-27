export type ErrorContext = "connection-test" | "model-list" | "ai-stream"

export function classifyHttpError(status: number, context: ErrorContext): string {
  if (status === 401 || status === 403) {
    return "认证失败，请检查 API Key 是否有效。"
  }
  if (status === 404) {
    if (context === "connection-test") return "模型不存在，请检查模型 ID 是否正确。"
    if (context === "model-list") return "模型列表端点不存在，请检查 Base URL 是否正确。"
    return "请求的资源不存在，请检查配置是否正确。"
  }
  if (status === 429) {
    return "请求频率过高，请稍后重试。"
  }
  if (status >= 500) {
    return "AI 服务暂时不可用，请稍后重试或更换 Provider。"
  }
  if (context === "connection-test") return "连接失败，请检查配置是否正确。"
  if (context === "model-list") return "获取模型列表失败，请检查配置是否正确。"
  return "AI 请求失败，请检查配置是否正确。"
}

export function classifyNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  if (message.includes("timeout") || message.includes("abort")) {
    return "连接超时，请检查网络连接或更换 Provider。"
  }
  if (message.includes("econnrefused") || message.includes("enotfound") || message.includes("fetch failed")) {
    return "无法连接到 AI 服务，请检查 Base URL 是否正确。"
  }
  return "网络异常，请检查网络连接并重试。"
}

/** Default fetch timeout in milliseconds for non-streaming requests */
export const AI_FETCH_TIMEOUT_MS = 15_000
