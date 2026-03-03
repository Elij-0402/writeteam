// src/lib/story-bible/consistency.ts
// Merged from consistency-types.ts + consistency-flags.ts

// --- Types (from consistency-types.ts) ---

export interface CanonFact {
  fact: string
  source: "human" | "ai"
  confidence: number
  updated_at: string
}

export interface TimelineEvent {
  event: string
  timeAnchor: string
  participants: string[]
  stateChanges: string[]
  source: "human" | "ai"
  confidence: number
  updated_at: string
}

export interface CharacterArcState {
  characterName: string
  motivation: string
  relationshipStatus: string
  secretProgress: string
  source: "human" | "ai"
  confidence: number
  updated_at: string
}

export interface ConstraintRule {
  rule: string
  category: "forbidden" | "required" | "style"
  source: "human" | "ai"
  confidence: number
  updated_at: string
}

export interface ConsistencyState {
  canonFacts: CanonFact[]
  timelineEvents: TimelineEvent[]
  characterArcStates: CharacterArcState[]
  constraintRules: ConstraintRule[]
}

export function createEmptyConsistencyState(): ConsistencyState {
  return {
    canonFacts: [],
    timelineEvents: [],
    characterArcStates: [],
    constraintRules: [],
  }
}

// --- Feature Flags (from consistency-flags.ts) ---

interface ConsistencyFlagEnv {
  NEXT_PUBLIC_CONSISTENCY_PREFLIGHT?: string
  NEXT_PUBLIC_STRUCTURED_CONTEXT?: string
  NEXT_PUBLIC_POST_CHECK_ENHANCED?: string
}

export interface ConsistencyFeatureFlags {
  consistencyPreflight: boolean
  structuredContext: boolean
  postCheckEnhanced: boolean
}

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"])
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"])

function resolveFlag(value: string | undefined, defaultValue = true): boolean {
  if (value === undefined) {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) {
    return defaultValue
  }

  if (TRUE_VALUES.has(normalized)) {
    return true
  }

  if (FALSE_VALUES.has(normalized)) {
    return false
  }

  return defaultValue
}

function getEnv(): ConsistencyFlagEnv {
  if (typeof process !== "undefined" && process.env) {
    return process.env as unknown as ConsistencyFlagEnv
  }
  return {}
}

export function isConsistencyPreflightEnabled(env?: ConsistencyFlagEnv): boolean {
  return resolveFlag((env ?? getEnv()).NEXT_PUBLIC_CONSISTENCY_PREFLIGHT)
}

export function isStructuredContextEnabled(env?: ConsistencyFlagEnv): boolean {
  return resolveFlag((env ?? getEnv()).NEXT_PUBLIC_STRUCTURED_CONTEXT)
}

export function isPostCheckEnhancedEnabled(env?: ConsistencyFlagEnv): boolean {
  return resolveFlag((env ?? getEnv()).NEXT_PUBLIC_POST_CHECK_ENHANCED)
}

export function getConsistencyFeatureFlags(env?: ConsistencyFlagEnv): ConsistencyFeatureFlags {
  const e = env ?? getEnv()
  return {
    consistencyPreflight: isConsistencyPreflightEnabled(e),
    structuredContext: isStructuredContextEnabled(e),
    postCheckEnhanced: isPostCheckEnhancedEnabled(e),
  }
}
