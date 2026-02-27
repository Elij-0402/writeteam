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
