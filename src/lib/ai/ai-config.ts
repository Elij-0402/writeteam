// Shared types for BYOK AI configuration (used by both client and server)

export interface AIProviderConfig {
  baseUrl: string    // e.g. "https://api.deepseek.com/v1"
  apiKey: string
  modelId: string    // e.g. "deepseek-chat"
  modelName: string  // display name
  configuredAt: number
}

// Custom headers used to pass AI config from client to server
export const AI_CONFIG_HEADERS = {
  BASE_URL: "X-AI-Base-URL",
  API_KEY: "X-AI-API-Key",
  MODEL_ID: "X-AI-Model-ID",
} as const

// localStorage key
export const AI_CONFIG_STORAGE_KEY = "writeteam-ai-config"

// Preset providers for quick setup
export const PROVIDER_PRESETS = [
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { name: "Ollama", baseUrl: "http://localhost:11434/v1" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { name: "硅基流动", baseUrl: "https://api.siliconflow.cn/v1" },
] as const

function normalizeBaseUrl(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl)
    const portPart = parsed.port ? `:${parsed.port}` : ""
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${portPart}`
  } catch {
    return null
  }
}

export function resolveProviderNameByBaseUrl(baseUrl: string): string {
  const normalizedTarget = normalizeBaseUrl(baseUrl)
  if (!normalizedTarget) {
    return "未知 Provider"
  }

  for (const preset of PROVIDER_PRESETS) {
    const normalizedPreset = normalizeBaseUrl(preset.baseUrl)
    if (normalizedPreset && normalizedPreset === normalizedTarget) {
      return preset.name
    }
  }

  return "未知 Provider"
}

/**
 * Create a temporary AI config override for recovery model switching.
 * Only replaces modelId (and optionally baseUrl). Does NOT modify localStorage.
 */
export function createTemporaryConfig(
  currentConfig: AIProviderConfig,
  overrides: { modelId: string; baseUrl?: string }
): AIProviderConfig {
  return {
    ...currentConfig,
    modelId: overrides.modelId,
    baseUrl: overrides.baseUrl ?? currentConfig.baseUrl,
    modelName: overrides.modelId,
  }
}

/**
 * Build HTTP headers from an AIProviderConfig for use in fetch() calls.
 */
export function buildConfigHeaders(config: AIProviderConfig): Record<string, string> {
  return {
    [AI_CONFIG_HEADERS.BASE_URL]: config.baseUrl,
    [AI_CONFIG_HEADERS.API_KEY]: config.apiKey,
    [AI_CONFIG_HEADERS.MODEL_ID]: config.modelId,
  }
}

/**
 * Format a raw Base URL input: add protocol, remove trailing slashes, append /v1.
 * Uses http:// for localhost/127.0.0.1, https:// for everything else.
 * Distinct from the private normalizeBaseUrl() which extracts protocol+hostname+port.
 */
export function formatBaseUrl(raw: string): string {
  let url = raw.trim()
  if (!url) return url
  if (!/^https?:\/\//i.test(url)) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)
    url = `${isLocal ? "http" : "https"}://${url}`
  }
  url = url.replace(/\/+$/, "")
  if (!/\/v\d+(\/|$)/.test(url)) {
    url = `${url}/v1`
  }
  return url
}

/**
 * Suggest matching provider Base URLs based on user input prefix.
 * Matches against preset name (case-insensitive) and baseUrl substring.
 */
export function suggestBaseUrl(input: string): string[] {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return []
  return PROVIDER_PRESETS
    .filter((preset) =>
      preset.name.toLowerCase().includes(trimmed) ||
      preset.baseUrl.toLowerCase().includes(trimmed)
    )
    .map((preset) => preset.baseUrl)
}
