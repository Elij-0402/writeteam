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

const ALLOWED_CHARACTER_MUTATION_FIELDS = [
  "name",
  "role",
  "description",
  "personality",
  "appearance",
  "backstory",
  "goals",
  "relationships",
  "notes",
] as const

type CharacterMutationField = (typeof ALLOWED_CHARACTER_MUTATION_FIELDS)[number]
type CharacterTableInsert = Database["public"]["Tables"]["characters"]["Insert"]
type CharacterTableUpdate = Database["public"]["Tables"]["characters"]["Update"]

export type CharacterCreateInput = Pick<CharacterTableInsert, CharacterMutationField>
export type CharacterUpdateInput = Pick<CharacterTableUpdate, CharacterMutationField>

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

function isCharacterMutationField(key: string): key is CharacterMutationField {
  return (ALLOWED_CHARACTER_MUTATION_FIELDS as readonly string[]).includes(key)
}

export function sanitizeCharacterUpdates(updates: Record<string, unknown>): CharacterUpdateInput {
  const filteredEntries = Object.entries(updates).filter(([key]) =>
    isCharacterMutationField(key)
  )

  return Object.fromEntries(filteredEntries) as CharacterUpdateInput
}

function normalizeOptionalTextField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function buildCharacterCreateInput(formData: FormData): CharacterCreateInput | null {
  const nameValue = formData.get("name")
  if (typeof nameValue !== "string") {
    return null
  }

  const name = nameValue.trim()
  if (!name) {
    return null
  }

  return {
    name,
    role: normalizeOptionalTextField(formData.get("role")),
    description: normalizeOptionalTextField(formData.get("description")),
    personality: normalizeOptionalTextField(formData.get("personality")),
    appearance: normalizeOptionalTextField(formData.get("appearance")),
    backstory: normalizeOptionalTextField(formData.get("backstory")),
    goals: normalizeOptionalTextField(formData.get("goals")),
    relationships: normalizeOptionalTextField(formData.get("relationships")),
    notes: normalizeOptionalTextField(formData.get("notes")),
  }
}

export function mapCharacterMutationError(errorMessage: string | null | undefined): string {
  if (!errorMessage) {
    return "操作失败：请稍后重试，若问题持续请刷新页面后再次尝试。"
  }

  const normalized = errorMessage.toLowerCase()
  if (normalized.includes("duplicate") || normalized.includes("unique")) {
    return "保存失败：存在同名角色，请修改角色名称后重试。"
  }
  if (normalized.includes("violates row-level security") || normalized.includes("permission")) {
    return "操作失败：你没有权限修改该角色，请确认项目归属后重试。"
  }
  if (normalized.includes("not null") || normalized.includes("null value")) {
    return "保存失败：请补全必填字段后再试。"
  }

  return "保存失败：请刷新后重试，如仍失败请检查角色字段是否填写完整。"
}
