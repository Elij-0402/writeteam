import type { AIFeature } from "@/lib/ai/feature-groups"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RouteCategory = "write" | "edit" | "check" | "chat" | "plan"

export type AIIntent =
  | "write"
  | "first-draft"
  | "expand"
  | "describe"
  | "quick-edit"
  | "rewrite"
  | "shrink"
  | "tone-shift"
  | "continuity-check"
  | "saliency"
  | "chat"
  | "brainstorm"
  | "twist"
  | "muse"
  | "bible-assist"
  | "scene-plan"
  | "canvas-generate"
  | "visualize"

export interface IntentConfig {
  intent: AIIntent
  feature: AIFeature
  category: RouteCategory
  temperature: number
  maxTokens: number
  streaming: boolean
  contextLevel: "full" | "summary" | "minimal"
  consistencyPreflight: boolean
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const INTENT_CONFIGS: readonly IntentConfig[] = [
  // -- write ------------------------------------------------------------------
  {
    intent: "write",
    feature: "write",
    category: "write",
    temperature: 0.8,
    maxTokens: 1000,
    streaming: true,
    contextLevel: "full",
    consistencyPreflight: true,
  },
  {
    intent: "first-draft",
    feature: "first-draft",
    category: "write",
    temperature: 0.85,
    maxTokens: 2500,
    streaming: true,
    contextLevel: "full",
    consistencyPreflight: false,
  },
  {
    intent: "expand",
    feature: "expand",
    category: "write",
    temperature: 0.8,
    maxTokens: 1500,
    streaming: true,
    contextLevel: "full",
    consistencyPreflight: false,
  },
  {
    intent: "describe",
    feature: "describe",
    category: "write",
    temperature: 0.9,
    maxTokens: 1000,
    streaming: true,
    contextLevel: "full",
    consistencyPreflight: false,
  },

  // -- edit -------------------------------------------------------------------
  {
    intent: "quick-edit",
    feature: "quick-edit",
    category: "edit",
    temperature: 0.7,
    maxTokens: 1500,
    streaming: true,
    contextLevel: "full",
    consistencyPreflight: true,
  },
  {
    intent: "rewrite",
    feature: "rewrite",
    category: "edit",
    temperature: 0.7,
    maxTokens: 1500,
    streaming: true,
    contextLevel: "full",
    consistencyPreflight: false,
  },
  {
    intent: "shrink",
    feature: "shrink",
    category: "edit",
    temperature: 0.5,
    maxTokens: 1000,
    streaming: true,
    contextLevel: "full",
    consistencyPreflight: false,
  },
  {
    intent: "tone-shift",
    feature: "tone-shift",
    category: "edit",
    temperature: 0.7,
    maxTokens: 1000,
    streaming: true,
    contextLevel: "full",
    consistencyPreflight: false,
  },

  // -- check ------------------------------------------------------------------
  {
    intent: "continuity-check",
    feature: "continuity-check",
    category: "check",
    temperature: 0.3,
    maxTokens: 1500,
    streaming: true,
    contextLevel: "full",
    consistencyPreflight: false,
  },
  {
    intent: "saliency",
    feature: "saliency",
    category: "check",
    temperature: 0.5,
    maxTokens: 500,
    streaming: false,
    contextLevel: "minimal",
    consistencyPreflight: false,
  },

  // -- chat -------------------------------------------------------------------
  {
    intent: "chat",
    feature: "chat",
    category: "chat",
    temperature: 0.7,
    maxTokens: 1000,
    streaming: true,
    contextLevel: "summary",
    consistencyPreflight: false,
  },
  {
    intent: "brainstorm",
    feature: "brainstorm",
    category: "chat",
    temperature: 1.0,
    maxTokens: 1000,
    streaming: true,
    contextLevel: "summary",
    consistencyPreflight: false,
  },
  {
    intent: "twist",
    feature: "twist",
    category: "chat",
    temperature: 0.9,
    maxTokens: 1000,
    streaming: true,
    contextLevel: "summary",
    consistencyPreflight: false,
  },
  {
    intent: "muse",
    feature: "muse",
    category: "chat",
    temperature: 0.9,
    maxTokens: 1200,
    streaming: true,
    contextLevel: "summary",
    consistencyPreflight: false,
  },
  {
    intent: "bible-assist",
    feature: "bible-assist",
    category: "chat",
    temperature: 0.7,
    maxTokens: 2000,
    streaming: true,
    contextLevel: "summary",
    consistencyPreflight: false,
  },

  // -- plan -------------------------------------------------------------------
  {
    intent: "scene-plan",
    feature: "scene-plan",
    category: "plan",
    temperature: 0.7,
    maxTokens: 1500,
    streaming: true,
    contextLevel: "summary",
    consistencyPreflight: false,
  },
  {
    intent: "canvas-generate",
    feature: "canvas-generate",
    category: "plan",
    temperature: 0.7,
    maxTokens: 2000,
    streaming: false,
    contextLevel: "summary",
    consistencyPreflight: false,
  },
  {
    intent: "visualize",
    feature: "visualize",
    category: "plan",
    temperature: 0.7,
    maxTokens: 500,
    streaming: false,
    contextLevel: "minimal",
    consistencyPreflight: false,
  },
] as const

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const intentMap = new Map<string, IntentConfig>(
  INTENT_CONFIGS.map((cfg) => [cfg.intent, cfg]),
)

export function getIntentConfig(intent: AIIntent): IntentConfig | undefined {
  return intentMap.get(intent)
}

export function getIntentsByCategory(category: RouteCategory): IntentConfig[] {
  return INTENT_CONFIGS.filter((cfg) => cfg.category === category)
}
