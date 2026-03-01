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

const ALLOWED_VISIBILITY_FIELDS = [
  "genre",
  "pov",
  "tone",
  "synopsis",
  "themes",
  "setting",
  "worldbuilding",
  "outline",
  "braindump",
  "notes",
  "characters",
] as const

type StoryBibleUpdateField = (typeof ALLOWED_STORY_BIBLE_UPDATE_FIELDS)[number]
type StoryBibleTableUpdate = Database["public"]["Tables"]["story_bibles"]["Update"]
export type StoryBibleUpdateInput = Pick<StoryBibleTableUpdate, StoryBibleUpdateField>
type VisibilityField = (typeof ALLOWED_VISIBILITY_FIELDS)[number]
export type StoryBibleVisibility = Record<VisibilityField, boolean>

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

function isVisibilityField(key: string): key is VisibilityField {
  return (ALLOWED_VISIBILITY_FIELDS as readonly string[]).includes(key)
}

export function validateVisibilityUpdate(value: unknown): {
  value: StoryBibleVisibility | null
  error: string | null
} {
  if (value == null) {
    return { value: null, error: null }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      value: null,
      error: "保存失败：可见性设置格式无效，请在“AI 可见性控制”中逐项开关后再保存。",
    }
  }

  const raw = value as Record<string, unknown>
  const unknownKeys = Object.keys(raw).filter((key) => !isVisibilityField(key))
  if (unknownKeys.length > 0) {
    return {
      value: null,
      error: `保存失败：可见性设置包含未知字段（${unknownKeys.join("、")}）。请刷新页面后重试，或仅使用预设开关字段。`,
    }
  }

  const normalized: StoryBibleVisibility = {
    genre: true,
    pov: true,
    tone: true,
    synopsis: true,
    themes: true,
    setting: true,
    worldbuilding: true,
    outline: true,
    braindump: true,
    notes: true,
    characters: true,
  }

  for (const key of ALLOWED_VISIBILITY_FIELDS) {
    const rawValue = raw[key]
    if (rawValue === undefined) {
      continue
    }

    if (typeof rawValue !== "boolean") {
      return {
        value: null,
        error: `保存失败：可见性字段「${key}」必须是布尔值（true/false），请修正后重试。`,
      }
    }

    normalized[key] = rawValue
  }

  return { value: normalized, error: null }
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
