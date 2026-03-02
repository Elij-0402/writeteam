import {
  isPlanningFeature,
  isWritingFeature,
} from "@/lib/ai/feature-groups"
import type { AIFeature } from "@/lib/ai/feature-groups"
import type {
  CanonFact,
  CharacterArcState,
  ConsistencyState,
  ConstraintRule,
  TimelineEvent,
} from "@/lib/story-bible/consistency-types"

const RULE_CATEGORY_PRIORITY: Record<ConstraintRule["category"], number> = {
  required: 0,
  forbidden: 1,
  style: 2,
}

function sortByDateConfidenceAndText<T>(
  items: T[],
  getUpdatedAt: (item: T) => string,
  getConfidence: (item: T) => number,
  getText: (item: T) => string
): T[] {
  return [...items].sort((a, b) => {
    const dateOrder = getUpdatedAt(b).localeCompare(getUpdatedAt(a))
    if (dateOrder !== 0) {
      return dateOrder
    }

    const confidenceOrder = getConfidence(b) - getConfidence(a)
    if (confidenceOrder !== 0) {
      return confidenceOrder
    }

    return getText(a).localeCompare(getText(b))
  })
}

function buildConstraintRuleLines(rules: ConstraintRule[]): string[] {
  return [...rules]
    .sort((a, b) => {
      const categoryOrder = RULE_CATEGORY_PRIORITY[a.category] - RULE_CATEGORY_PRIORITY[b.category]
      if (categoryOrder !== 0) {
        return categoryOrder
      }

      const dateOrder = b.updated_at.localeCompare(a.updated_at)
      if (dateOrder !== 0) {
        return dateOrder
      }

      const confidenceOrder = b.confidence - a.confidence
      if (confidenceOrder !== 0) {
        return confidenceOrder
      }

      return a.rule.localeCompare(b.rule)
    })
    .slice(0, 6)
    .map((rule) => `- [${rule.category}] ${rule.rule}`)
}

function buildCharacterArcLines(states: CharacterArcState[]): string[] {
  return sortByDateConfidenceAndText(
    states,
    (state) => state.updated_at,
    (state) => state.confidence,
    (state) => state.characterName
  )
    .slice(0, 5)
    .map((state) => {
      const parts = [
        `motivation: ${state.motivation}`,
        `relationship: ${state.relationshipStatus}`,
        `secret: ${state.secretProgress}`,
      ]
      return `- ${state.characterName}: ${parts.join("; ")}`
    })
}

function buildCanonFactLines(facts: CanonFact[]): string[] {
  return sortByDateConfidenceAndText(
    facts,
    (fact) => fact.updated_at,
    (fact) => fact.confidence,
    (fact) => fact.fact
  )
    .slice(0, 5)
    .map((fact) => `- ${fact.fact}`)
}

function buildTimelineLines(events: TimelineEvent[]): string[] {
  return sortByDateConfidenceAndText(
    events,
    (event) => event.updated_at,
    (event) => event.confidence,
    (event) => event.event
  )
    .slice(0, 5)
    .map((event) => {
      const details: string[] = [event.event]
      if (event.timeAnchor) {
        details.push(`time: ${event.timeAnchor}`)
      }
      if (event.participants.length > 0) {
        details.push(`participants: ${event.participants.join("/")}`)
      }
      return `- ${details.join(" | ")}`
    })
}

export function buildStructuredContext(
  consistencyState: ConsistencyState | undefined,
  feature: AIFeature
): string {
  if (!consistencyState) {
    return ""
  }

  const sections: string[] = []

  if (isWritingFeature(feature) || feature === "continuity-check") {
    const ruleLines = buildConstraintRuleLines(consistencyState.constraintRules)
    if (ruleLines.length > 0) {
      sections.push(`Constraint rules:\n${ruleLines.join("\n")}`)
    }
  }

  if (isWritingFeature(feature) || isPlanningFeature(feature) || feature === "continuity-check") {
    const characterLines = buildCharacterArcLines(consistencyState.characterArcStates)
    if (characterLines.length > 0) {
      sections.push(`Character arc states:\n${characterLines.join("\n")}`)
    }
  }

  if (isPlanningFeature(feature) || feature === "continuity-check") {
    const timelineLines = buildTimelineLines(consistencyState.timelineEvents)
    if (timelineLines.length > 0) {
      sections.push(`Timeline events:\n${timelineLines.join("\n")}`)
    }
  }

  if (feature === "continuity-check") {
    const factLines = buildCanonFactLines(consistencyState.canonFacts)
    if (factLines.length > 0) {
      sections.push(`Canon facts:\n${factLines.join("\n")}`)
    }
  }

  if (sections.length === 0) {
    return ""
  }

  return `STRUCTURED CONTEXT (task-aware minimal):\n${sections.join("\n\n")}`
}
