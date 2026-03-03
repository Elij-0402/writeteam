import { getIntentConfig, type AIIntent } from "@/lib/ai/intent-config"

const INDEPENDENT_ENDPOINTS: Record<string, string> = {
  plugin: "/api/ai/plugin",
  models: "/api/ai/models",
  "test-connection": "/api/ai/test-connection",
  feedback: "/api/ai/check",
}

export function getEndpointForFeature(feature: string): string {
  if (feature in INDEPENDENT_ENDPOINTS) {
    return INDEPENDENT_ENDPOINTS[feature]
  }
  const config = getIntentConfig(feature as AIIntent)
  if (!config) {
    return `/api/ai/${feature}` // fallback for unknown features
  }
  return `/api/ai/${config.category}`
}
