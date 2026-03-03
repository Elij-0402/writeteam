import { createOpenAI } from "@ai-sdk/openai"

/**
 * BYOK（Bring Your Own Key）配置，用于创建 AI SDK provider。
 */
export interface BYOKConfig {
  baseUrl: string
  apiKey: string
  modelId: string
}

/**
 * 根据用户的 BYOK 配置创建 AI SDK provider 实例。
 *
 * 使用 @ai-sdk/openai 的 OpenAI-compatible 模式，
 * 支持 DeepSeek、OpenRouter、Ollama 等任意兼容端点。
 *
 * 当 apiKey 为空字符串时传 undefined（Ollama 等本地模型不需要密钥）。
 */
export function createBYOKProvider(config: BYOKConfig) {
  const provider = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey || undefined,
  })

  return provider(config.modelId)
}
