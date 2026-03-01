/**
 * @deprecated 已被 BYOK 系统取代。用户现在通过 /settings 页面自行配置 AI 服务商。
 * 请使用 src/lib/ai/ai-config.ts 中的类型和 src/lib/ai/resolve-config.ts 中的配置解析。
 * 保留此文件仅为向后兼容，将在后续版本中移除。
 */

export interface AIModel {
  id: string
  name: string
  provider: "openai" | "anthropic" | "google"
  apiModel: string // actual model string sent to API
  maxTokens: number
  defaultTemperature: number
  costPer1kTokens: number // for display only
  description: string
}

export const MODEL_REGISTRY: AIModel[] = [
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    apiModel: "gpt-4o-mini",
    maxTokens: 4096,
    defaultTemperature: 0.7,
    costPer1kTokens: 0.15,
    description: "快速且经济，适合日常写作",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    apiModel: "gpt-4o",
    maxTokens: 4096,
    defaultTemperature: 0.7,
    costPer1kTokens: 2.5,
    description: "更强大的推理和创作能力",
  },
]

export function getModel(modelId: string): AIModel {
  return MODEL_REGISTRY.find((m) => m.id === modelId) ?? MODEL_REGISTRY[0]
}

export function getDefaultModelId(): string {
  return "gpt-4o-mini"
}
