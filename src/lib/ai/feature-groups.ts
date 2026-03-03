export type AIFeature =
  | "write"
  | "rewrite"
  | "expand"
  | "describe"
  | "brainstorm"
  | "first-draft"
  | "scene-plan"
  | "continuity-check"
  | "chat"
  | "shrink"
  | "twist"
  | "tone-shift"
  | "quick-edit"
  | "plugin"
  | "muse"
  | "saliency"
  | "canvas-generate"
  | "visualize"
  | "bible-assist"

const WRITING_FEATURES: readonly AIFeature[] = [
  "write",
  "rewrite",
  "expand",
  "first-draft",
  "describe",
  "shrink",
  "tone-shift",
  "quick-edit",
  "plugin",
]

const PLANNING_FEATURES: readonly AIFeature[] = [
  "scene-plan",
  "brainstorm",
  "twist",
  "muse",
]

const CHECK_FEATURES: readonly AIFeature[] = ["continuity-check"]

export function isWritingFeature(feature: AIFeature): boolean {
  return WRITING_FEATURES.includes(feature)
}

export function isPlanningFeature(feature: AIFeature): boolean {
  return PLANNING_FEATURES.includes(feature)
}

export function isCheckFeature(feature: AIFeature): boolean {
  return CHECK_FEATURES.includes(feature)
}
