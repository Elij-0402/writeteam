import {
  createEmptyConsistencyState,
  type CharacterArcState,
  type ConsistencyState,
  type ConstraintRule,
  type TimelineEvent,
} from "@/lib/story-bible/consistency-types"

const PENDING_CONFIRMATION_MARKER = "[pendingConfirmation]"

interface LegacyBibleSource {
  worldbuilding?: unknown
  notes?: unknown
  outline?: unknown
}

interface LegacyCharacterSource {
  name?: unknown
  goals?: unknown
  relationships?: unknown
  notes?: unknown
  backstory?: unknown
}

interface LegacyConsistencySource {
  bible?: LegacyBibleSource | null
  characters?: LegacyCharacterSource[] | null
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function withConfidenceMarker(text: string, confidence: number): string {
  if (confidence >= 0.5) {
    return text
  }

  return `${PENDING_CONFIRMATION_MARKER} ${text}`
}

const OUTLINE_COMMON_KEYS = [
  "title",
  "chapter",
  "scene",
  "summary",
  "note",
  "notes",
  "description",
  "content",
  "text",
  "beat",
  "beats",
  "event",
  "events",
] as const

function appendOutlineText(lines: string[], seen: Set<string>, text: string): void {
  for (const line of text.split(/\r?\n/)) {
    const normalized = line.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    lines.push(normalized)
  }
}

function extractStructuredOutlineStrings(
  value: unknown,
  lines: string[],
  seen: Set<string>
): void {
  if (typeof value === "string") {
    appendOutlineText(lines, seen, value)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractStructuredOutlineStrings(item, lines, seen)
    }
    return
  }

  if (!value || typeof value !== "object") {
    return
  }

  const record = value as Record<string, unknown>

  for (const key of OUTLINE_COMMON_KEYS) {
    if (key in record) {
      extractStructuredOutlineStrings(record[key], lines, seen)
    }
  }

  for (const [key, nestedValue] of Object.entries(record)) {
    if (OUTLINE_COMMON_KEYS.includes(key as (typeof OUTLINE_COMMON_KEYS)[number])) {
      continue
    }
    extractStructuredOutlineStrings(nestedValue, lines, seen)
  }
}

function extractOutlineLines(outline: unknown): string[] {
  if (!outline) {
    return []
  }

  if (Array.isArray(outline)) {
    const lines: string[] = []
    extractStructuredOutlineStrings(outline, lines, new Set<string>())
    return lines
  }

  if (typeof outline === "string") {
    const raw = outline.trim()
    if (raw.length === 0) {
      return []
    }

    if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw)
        const lines: string[] = []
        extractStructuredOutlineStrings(parsed, lines, new Set<string>())
        return lines
      } catch {
        // Fallback to plain text line splitting.
      }
    }

    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  if (typeof outline === "object") {
    const lines: string[] = []
    extractStructuredOutlineStrings(outline, lines, new Set<string>())
    return lines
  }

  return []
}

function createCharacterArcState(character: LegacyCharacterSource, now: string): CharacterArcState | null {
  const characterName = toNonEmptyString(character.name)
  if (!characterName) {
    return null
  }

  const goals = toNonEmptyString(character.goals)
  const relationships = toNonEmptyString(character.relationships)
  const notes = toNonEmptyString(character.notes) ?? toNonEmptyString(character.backstory)

  if (!goals && !relationships && !notes) {
    return null
  }

  const confidence = notes && !goals && !relationships ? 0.4 : 0.7

  return {
    characterName,
    motivation: withConfidenceMarker(goals ?? "未知", confidence),
    relationshipStatus: withConfidenceMarker(relationships ?? "未知", confidence),
    secretProgress: withConfidenceMarker(notes ?? "未知", confidence),
    source: "ai",
    confidence,
    updated_at: now,
  }
}

export function extractConsistencyState(input: LegacyConsistencySource): ConsistencyState {
  const now = new Date().toISOString()
  const result = createEmptyConsistencyState()

  const worldbuilding = toNonEmptyString(input.bible?.worldbuilding)
  if (worldbuilding) {
    result.canonFacts.push({
      fact: worldbuilding,
      source: "ai",
      confidence: 0.75,
      updated_at: now,
    })

    const rule: ConstraintRule = {
      rule: worldbuilding,
      category: "required",
      source: "ai",
      confidence: 0.75,
      updated_at: now,
    }
    result.constraintRules.push(rule)
  }

  const notes = toNonEmptyString(input.bible?.notes)
  if (notes) {
    result.canonFacts.push({
      fact: withConfidenceMarker(notes, 0.35),
      source: "ai",
      confidence: 0.35,
      updated_at: now,
    })
  }

  const outlineLines = extractOutlineLines(input.bible?.outline)
  for (const line of outlineLines) {
    const timelineEvent: TimelineEvent = {
      event: line,
      timeAnchor: "未确认",
      participants: [],
      stateChanges: [],
      source: "ai",
      confidence: 0.6,
      updated_at: now,
    }
    result.timelineEvents.push(timelineEvent)
  }

  for (const character of input.characters ?? []) {
    const arcState = createCharacterArcState(character, now)
    if (arcState) {
      result.characterArcStates.push(arcState)
    }
  }

  return result
}

