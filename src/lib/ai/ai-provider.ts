import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModelV1 } from "ai"
import type { ResolvedAIConfig } from "@/lib/ai/resolve-config"

/** BYOK 配置类型，复用 pipeline 中已有的 ResolvedAIConfig */
export type BYOKConfig = ResolvedAIConfig

/**
 * 根据用户的 BYOK 配置创建 AI SDK provider 实例。
 *
 * 使用 @ai-sdk/openai 的 OpenAI-compatible 模式，
 * 支持 DeepSeek、OpenRouter、Ollama 等任意兼容端点。
 *
 * 当 apiKey 为空字符串时传 undefined（Ollama 等本地模型不需要密钥）。
 * URL 验证由上游 resolveAIConfig() 负责。
 */
export function createBYOKProvider(config: BYOKConfig): LanguageModelV1 {
  const provider = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey || undefined,
  })

  return provider(config.modelId)
}
