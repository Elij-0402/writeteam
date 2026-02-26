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
