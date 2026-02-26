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
