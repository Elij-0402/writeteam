import type { Database } from "@/types/database"

const ALLOWED_STORY_BIBLE_UPDATE_FIELDS = [
  "braindump",
  "genre",
  "style",
  "prose_mode",
  "style_sample",
  "synopsis",
  "themes",
  "setting",
  "pov",
  "tense",
  "worldbuilding",
  "outline",
  "notes",
  "tone",
  "ai_rules",
  "visibility",
] as const

type StoryBibleUpdateField = (typeof ALLOWED_STORY_BIBLE_UPDATE_FIELDS)[number]
type StoryBibleTableUpdate = Database["public"]["Tables"]["story_bibles"]["Update"]
export type StoryBibleUpdateInput = Pick<StoryBibleTableUpdate, StoryBibleUpdateField>

function isStoryBibleUpdateField(key: string): key is StoryBibleUpdateField {
  return (ALLOWED_STORY_BIBLE_UPDATE_FIELDS as readonly string[]).includes(key)
}

export function sanitizeStoryBibleUpdates(updates: Record<string, unknown>): StoryBibleUpdateInput {
  const filteredEntries = Object.entries(updates).filter(([key]) =>
    isStoryBibleUpdateField(key)
  )

  return Object.fromEntries(filteredEntries) as StoryBibleUpdateInput
}

export function hasConcurrentStoryBibleUpdate(
  currentUpdatedAt: string | null | undefined,
  expectedUpdatedAt: string | null | undefined
): boolean {
  return Boolean(expectedUpdatedAt && currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt)
}
