import type { NextRequest } from "next/server"
import { AI_CONFIG_HEADERS } from "@/lib/ai/ai-config"

export interface ResolvedAIConfig {
  baseUrl: string
  apiKey: string
  modelId: string
}

/**
 * Extract AI configuration from request headers.
 * Returns null if base URL or model ID is missing.
 * API key may be empty (e.g. for Ollama).
 */
export function resolveAIConfig(request: NextRequest): ResolvedAIConfig | null {
  const baseUrl = request.headers.get(AI_CONFIG_HEADERS.BASE_URL)
  const apiKey = request.headers.get(AI_CONFIG_HEADERS.API_KEY) || ""
  const modelId = request.headers.get(AI_CONFIG_HEADERS.MODEL_ID)

  if (!baseUrl || !modelId) {
    return null
  }

  // Basic URL validation
  try {
    new URL(baseUrl)
  } catch {
    return null
  }

  return { baseUrl, apiKey, modelId }
}
