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
