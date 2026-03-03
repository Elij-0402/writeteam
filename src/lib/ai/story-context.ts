import { SupabaseClient } from "@supabase/supabase-js"
import { buildProseModeGuidanceWithOverride } from "@/lib/ai/prose-mode"
import { buildStructuredContext } from "@/lib/ai/structured-context"
import { getIntentConfig } from "@/lib/ai/intent-config"
import { parseWorldbuildingSections } from "@/lib/story-bible/worldbuilding-sections"
import { isStructuredContextEnabled } from "@/lib/story-bible/consistency"
import type { AIFeature } from "@/lib/ai/feature-groups"
import type { AIIntent } from "@/lib/ai/intent-config"
import type { ConsistencyState } from "@/lib/story-bible/consistency"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoryBibleData {
  genre: string | null
  style: string | null
  prose_mode: string | null
  style_sample: string | null
  synopsis: string | null
  themes: string | null
  setting: string | null
  pov: string | null
  tense: string | null
  worldbuilding: string | null
  outline: unknown | null
  notes: string | null
  braindump: string | null
  tone: string | null
  ai_rules: string | null
  visibility: Record<string, boolean> | null
}

export interface SaliencyMap {
  activeCharacters: string[]
  activeLocations: string[]
  activePlotlines: string[]
}

interface CharacterData {
  name: string
  role: string | null
  description: string | null
  personality: string | null
  appearance: string | null
  backstory: string | null
  goals: string | null
  relationships: string | null
  notes: string | null
  dialogue_style: string | null
}

export interface StoryContext {
  bible: StoryBibleData | null
  characters: CharacterData[]
  consistencyState?: ConsistencyState
}

interface StoryPromptOptions {
  feature: AIFeature
  proseMode?: string | null // runtime override for prose mode
  saliencyMap?: SaliencyMap | null // saliency data for context-aware AI
}

interface StoryPromptContext {
  fullContext: string // The complete formatted context to inject into system prompt
}

const VISIBILITY_FIELDS = [
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

type VisibilityField = (typeof VISIBILITY_FIELDS)[number]
type VisibilityMap = Record<VisibilityField, boolean>

type ContextLevel = "full" | "summary" | "minimal"

function normalizeNullableString(input: unknown): string | null {
  return typeof input === "string" ? input : null
}

function normalizeCharacter(input: unknown): CharacterData {
  const row =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}

  return {
    name: typeof row.name === "string" ? row.name : "",
    role: normalizeNullableString(row.role),
    description: normalizeNullableString(row.description),
    personality: normalizeNullableString(row.personality),
    appearance: normalizeNullableString(row.appearance),
    backstory: normalizeNullableString(row.backstory),
    goals: normalizeNullableString(row.goals),
    relationships: normalizeNullableString(row.relationships),
    notes: normalizeNullableString(row.notes),
    dialogue_style: normalizeNullableString(row.dialogue_style),
  }
}

function mapCharacters(rows: unknown): CharacterData[] {
  if (!Array.isArray(rows)) {
    return []
  }

  return rows.map((row) => normalizeCharacter(row))
}

function applySeriesFallbackFields(
  bible: StoryBibleData,
  seriesBibleData: Record<string, unknown>
): void {
  if (bible.genre == null) bible.genre = normalizeNullableString(seriesBibleData.genre)
  if (bible.style == null) bible.style = normalizeNullableString(seriesBibleData.style)
  if (bible.themes == null) bible.themes = normalizeNullableString(seriesBibleData.themes)
  if (bible.setting == null) bible.setting = normalizeNullableString(seriesBibleData.setting)
  if (bible.worldbuilding == null) {
    bible.worldbuilding = normalizeNullableString(seriesBibleData.worldbuilding)
  }
  if (bible.notes == null) bible.notes = normalizeNullableString(seriesBibleData.notes)
}

function buildSeriesFallbackBible(seriesBibleData: Record<string, unknown>): StoryBibleData {
  return {
    genre: normalizeNullableString(seriesBibleData.genre),
    style: normalizeNullableString(seriesBibleData.style),
    prose_mode: null,
    style_sample: null,
    synopsis: null,
    themes: normalizeNullableString(seriesBibleData.themes),
    setting: normalizeNullableString(seriesBibleData.setting),
    pov: null,
    tense: null,
    worldbuilding: normalizeNullableString(seriesBibleData.worldbuilding),
    outline: null,
    notes: normalizeNullableString(seriesBibleData.notes),
    braindump: null,
    tone: null,
    ai_rules: null,
    visibility: normalizeVisibility(null),
  }
}

function normalizeVisibility(input: unknown): VisibilityMap {
  const defaults: VisibilityMap = {
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

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return defaults
  }

  const raw = input as Record<string, unknown>
  for (const key of VISIBILITY_FIELDS) {
    const value = raw[key]
    if (typeof value === "boolean") {
      defaults[key] = value
    }
  }

  return defaults
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function fetchStoryContext(
  supabase: SupabaseClient,
  projectId: string,
  userId?: string
): Promise<StoryContext> {
  interface UserScopedQuery {
    eq: (column: string, value: string) => unknown
  }

  const withUserScope = (query: UserScopedQuery): void => {
    if (userId) {
      query.eq("user_id", userId)
    }
  }

  const bibleQuery = supabase
    .from("story_bibles")
    .select("*")
    .eq("project_id", projectId)
  withUserScope(bibleQuery)

  const charactersQuery = supabase
    .from("characters")
    .select("*")
    .eq("project_id", projectId)
  withUserScope(charactersQuery)

  const projectQuery = supabase
    .from("projects")
    .select("series_id")
    .eq("id", projectId)
  withUserScope(projectQuery)

  // Fetch project-level data
  const [bibleResult, charsResult, projectResult] = await Promise.all([
    bibleQuery.single(),
    charactersQuery.limit(15),
    projectQuery.single(),
  ])

  if (bibleResult.error && bibleResult.error.code !== "PGRST116") {
    console.error("Failed to fetch story bible:", bibleResult.error)
  }
  if (charsResult.error) {
    console.error("Failed to fetch characters:", charsResult.error)
  }

  const bibleNotFound = bibleResult.error?.code === "PGRST116"
  if (projectResult.error && projectResult.error.code !== "PGRST116") {
    console.error("Failed to fetch project series info:", projectResult.error)
  }

  // Optionally fetch series bible if project belongs to a series
  let seriesBibleData: Record<string, unknown> | null = null
  const shouldTrySeriesFallback =
    !projectResult.error && (!bibleResult.error || bibleNotFound)
  const seriesId =
    projectResult.data && typeof projectResult.data.series_id === "string"
      ? projectResult.data.series_id
      : null

  if (shouldTrySeriesFallback && seriesId) {
    const seriesBibleQuery = supabase
      .from("series_bibles")
      .select("*")
      .eq("series_id", seriesId)
    withUserScope(seriesBibleQuery)

    const { data: sb, error: seriesError } = await seriesBibleQuery.single()
    if (seriesError && seriesError.code !== "PGRST116") {
      console.error("Failed to fetch series bible:", seriesError)
    }
    if (!seriesError && sb && typeof sb === "object" && !Array.isArray(sb)) {
      seriesBibleData = sb
    }
  }

  const bible: StoryBibleData | null = bibleResult.data
    ? {
        genre: bibleResult.data.genre ?? null,
        style: bibleResult.data.style ?? null,
        prose_mode: bibleResult.data.prose_mode ?? null,
        style_sample: bibleResult.data.style_sample ?? null,
        synopsis: bibleResult.data.synopsis ?? null,
        themes: bibleResult.data.themes ?? null,
        setting: bibleResult.data.setting ?? null,
        pov: bibleResult.data.pov ?? null,
        tense: bibleResult.data.tense ?? null,
        worldbuilding: bibleResult.data.worldbuilding ?? null,
        outline: bibleResult.data.outline ?? null,
        notes: bibleResult.data.notes ?? null,
        braindump: bibleResult.data.braindump ?? null,
        tone: bibleResult.data.tone ?? null,
        ai_rules: bibleResult.data.ai_rules ?? null,
        visibility: normalizeVisibility(bibleResult.data.visibility),
      }
    : null

  // Merge series bible data into project bible (series data as fallback)
  if (seriesBibleData && bible) {
    applySeriesFallbackFields(bible, seriesBibleData)
  } else if (seriesBibleData && !bible) {
    const seriesFallbackBible = buildSeriesFallbackBible(seriesBibleData)
    const characters = mapCharacters(charsResult.data)

    return {
      bible: seriesFallbackBible,
      characters,
    }
  }

  const characters = mapCharacters(charsResult.data)

  return {
    bible,
    characters,
  }
}

// ---------------------------------------------------------------------------
// Prompt orchestration
// ---------------------------------------------------------------------------

export function buildStoryPromptContext(
  ctx: StoryContext,
  options: StoryPromptOptions
): StoryPromptContext {
  const { feature, proseMode, saliencyMap } = options
  const bible = ctx.bible
  const vis = normalizeVisibility(bible?.visibility)
  const structuredContextEnabled = isStructuredContextEnabled()

  // Determine context level from intent config
  const intentCfg = getIntentConfig(feature as AIIntent)
  const rawLevel = intentCfg?.contextLevel ?? "summary"
  const contextLevel: ContextLevel =
    rawLevel === "full" ? "full" : rawLevel === "minimal" ? "minimal" : "summary"

  // Helper: check if a field is visible (default true if not set)
  const isVisible = (field: VisibilityField) => vis[field] !== false

  const sections: string[] = [
    buildAIRulesGuidance(bible?.ai_rules ?? null),
    bible && isVisible("genre") ? buildGenreStyleGuidance(bible) : "",
    bible && isVisible("pov") ? buildWritingParamsGuidance(bible) : "",
    isVisible("tone") ? buildToneGuidance(bible?.tone ?? null) : "",
    isVisible("synopsis") ? buildSynopsisGuidance(bible?.synopsis ?? null, contextLevel) : "",
    isVisible("themes") ? buildThemesGuidance(bible?.themes ?? null, contextLevel) : "",
    isVisible("setting") ? buildSettingGuidance(bible?.setting ?? null, contextLevel) : "",
    isVisible("worldbuilding") ? buildWorldbuildingGuidance(bible?.worldbuilding ?? null) : "",
    isVisible("outline") ? buildOutlineGuidance(bible?.outline ?? null, contextLevel) : "",
    isVisible("braindump") ? buildBraindumpGuidance(bible?.braindump ?? null, contextLevel) : "",
    isVisible("notes") ? buildNotesGuidance(bible?.notes ?? null) : "",
    isVisible("characters") ? buildCharacterGuidance(ctx.characters, contextLevel) : "",
    isVisible("characters") ? buildCharacterHealthGuidance(ctx.characters) : buildCharacterVisibilityNotice(),
    buildProseModeSection(bible, proseMode ?? null),
    structuredContextEnabled
      ? buildStructuredContext(ctx.consistencyState, feature, {
          characters: isVisible("characters"),
        })
      : "",
    saliencyMap ? buildSaliencyGuidance(saliencyMap) : "",
  ]

  const fullContext = sections.filter(Boolean).join("\n\n")
  return { fullContext }
}

// ---------------------------------------------------------------------------
// Domain builders (internal)
// ---------------------------------------------------------------------------

function buildAIRulesGuidance(aiRules: string | null): string {
  if (!aiRules) return ""
  return `AUTHOR'S RULES (highest priority \u2014 override all other guidance):\n${aiRules}`
}

function buildGenreStyleGuidance(bible: StoryBibleData): string {
  if (!bible.genre && !bible.style) return ""

  const genrePart = bible.genre ? `${bible.genre} ` : ""
  const stylePart = bible.style ? ` with ${bible.style} style` : ""
  return `This is a ${genrePart}story${stylePart}.`
}

function buildWritingParamsGuidance(bible: StoryBibleData): string {
  if (!bible.pov && !bible.tense) return ""

  const lines: string[] = ["STRICT WRITING PARAMETERS (never deviate):"]
  if (bible.pov) {
    lines.push(
      `- Point of View: ${bible.pov}. Maintain this POV consistently \u2014 never slip into another perspective.`
    )
  }
  if (bible.tense) {
    lines.push(
      `- Tense: ${bible.tense}. Maintain this tense throughout \u2014 never shift tenses accidentally.`
    )
  }
  return lines.join("\n")
}

function buildToneGuidance(tone: string | null): string {
  if (!tone) return ""
  return `EMOTIONAL TONE: ${tone}. Let this tone guide word choice, pacing, and atmospheric details.`
}

function buildSynopsisGuidance(synopsis: string | null, contextLevel: ContextLevel): string {
  if (!synopsis) return ""
  if (contextLevel === "full") {
    return `STORY SYNOPSIS (for narrative direction):\n${synopsis}\nUse this to maintain story coherence and foreshadow upcoming events.`
  }
  return `STORY SYNOPSIS:\n${synopsis}`
}

function buildThemesGuidance(themes: string | null, contextLevel: ContextLevel): string {
  if (!themes) return ""
  if (contextLevel === "full") {
    return `THEMES TO WEAVE: ${themes}\nSubtly reinforce these themes through imagery, dialogue subtext, and character choices \u2014 never state them explicitly.`
  }
  return `THEMES: ${themes}`
}

function buildSettingGuidance(setting: string | null, contextLevel: ContextLevel): string {
  if (!setting) return ""
  if (contextLevel === "full") {
    return `SETTING: ${setting}\nGround scenes in this environment \u2014 use setting-specific sensory details, weather, architecture, sounds, and smells.`
  }
  return `SETTING: ${setting}`
}

function buildWorldbuildingGuidance(worldbuilding: string | null): string {
  if (!worldbuilding) return ""

  const sections = parseWorldbuildingSections(worldbuilding)
  if (sections.length > 1 || (sections.length === 1 && sections[0].title !== "\u901A\u7528")) {
    // Structured format - render with sub-headers
    const sectionText = sections
      .filter(s => s.content.trim())
      .map(s => `### ${s.title}\n${s.content}`)
      .join("\n\n")
    return `WORLD RULES (hard constraints \u2014 never violate):\n${sectionText}`
  } else if (sections.length === 1) {
    // Legacy flat text
    return `WORLD RULES (hard constraints \u2014 never violate):\n${sections[0].content}\nAll narrative elements must be consistent with these established rules.`
  }

  // Fallback
  const truncated = worldbuilding.slice(0, 2000)
  return `WORLD RULES (hard constraints \u2014 never violate):\n${truncated}\nAll narrative elements must be consistent with these established rules.`
}

function buildOutlineGuidance(outline: unknown | null, contextLevel: ContextLevel): string {
  if (!outline) return ""

  let outlineStr: string
  if (typeof outline === "string") {
    outlineStr = outline
  } else {
    outlineStr = JSON.stringify(outline)
  }
  outlineStr = outlineStr.slice(0, 2000)

  if (contextLevel === "full") {
    return `STORY OUTLINE (narrative roadmap):\n${outlineStr}\nUse this to maintain plot direction and pacing.`
  }
  return `STORY OUTLINE:\n${outlineStr}`
}

function buildBraindumpGuidance(braindump: string | null, contextLevel: ContextLevel): string {
  if (!braindump) return ""
  const truncated = braindump.slice(0, 1500)
  if (contextLevel === "full") {
    return `AUTHOR'S NOTES (creative seeds):\n${truncated}\nDraw from these ideas when they naturally fit the scene.`
  }
  return `AUTHOR'S NOTES:\n${truncated}`
}

function buildNotesGuidance(notes: string | null): string {
  if (!notes) return ""
  return `AUTHOR'S ADDITIONAL NOTES:\n${notes}\nFollow these instructions where applicable.`
}

function buildCharacterGuidance(
  characters: CharacterData[],
  contextLevel: ContextLevel
): string {
  if (characters.length === 0) return ""
  if (contextLevel === "minimal") return ""

  const chars = characters.slice(0, 15)
  const lines: string[] = ["CHARACTERS:"]

  for (const c of chars) {
    const nameWithRole = c.role ? `${c.name} (${c.role})` : c.name

    if (contextLevel === "full") {
      // Full context: all available fields
      const details: string[] = []
      if (c.description) details.push(c.description)
      if (c.appearance) details.push(`Appearance: ${c.appearance}`)
      if (c.personality) details.push(`Personality: ${c.personality}`)
      if (c.dialogue_style) details.push(`Dialogue style: ${c.dialogue_style}`)
      if (c.backstory) details.push(`Backstory: ${c.backstory}`)
      if (c.goals) details.push(`Goals: ${c.goals}`)
      if (c.relationships) details.push(`Relationships: ${c.relationships}`)
      if (c.notes) details.push(`Notes: ${c.notes}`)
      lines.push(`- ${nameWithRole}${details.length > 0 ? ": " + details.join(". ") + "." : ""}`)
    } else {
      // Summary context: core identity fields (no appearance, backstory, notes)
      const details: string[] = []
      if (c.description) details.push(c.description)
      if (c.personality) details.push(`Personality: ${c.personality}`)
      if (c.goals) details.push(`Goals: ${c.goals}`)
      if (c.relationships) details.push(`Relationships: ${c.relationships}`)
      if (c.dialogue_style) details.push(`Dialogue style: ${c.dialogue_style}`)
      lines.push(`- ${nameWithRole}${details.length > 0 ? ": " + details.join(". ") + "." : ""}`)
    }
  }

  return lines.join("\n")
}

function buildCharacterVisibilityNotice(): string {
  return "CHARACTER CONTEXT NOTICE:\n角色上下文已关闭。若当前任务需要人物一致性，请在「AI 可见性控制」中开启「角色信息」后重试。"
}

function buildCharacterHealthGuidance(characters: CharacterData[]): string {
  if (characters.length === 0) {
    return "CHARACTER CONTEXT NOTICE:\n当前没有角色资料。若输出出现人物行为不一致，建议先在故事圣经中新增核心角色（姓名、定位、性格）后重试。"
  }

  const duplicateNames = new Set<string>()
  const seenNames = new Set<string>()
  let missingIdentityFields = 0
  for (const character of characters) {
    const name = character.name.trim()
    if (seenNames.has(name)) {
      duplicateNames.add(name)
    } else {
      seenNames.add(name)
    }

    if (!character.description && !character.personality) {
      missingIdentityFields += 1
    }
  }

  const notices: string[] = []
  if (duplicateNames.size > 0) {
    notices.push(
      `检测到同名角色：${Array.from(duplicateNames).join("、")}。建议在故事圣经中重命名，避免 AI 混淆人物。`
    )
  }
  if (missingIdentityFields > 0) {
    notices.push(
      `${missingIdentityFields} 个角色缺少\u201C描述/性格\u201D关键字段。建议补全后再执行写作类功能，以提升角色一致性。`
    )
  }

  if (notices.length === 0) {
    return ""
  }

  return `CHARACTER CONTEXT NOTICE:\n${notices.join("\n")}`
}

function buildProseModeSection(
  bible: StoryBibleData | null,
  proseMode: string | null
): string {
  const proseSource = bible ?? (proseMode ? { style: null, prose_mode: null, style_sample: null } : null)
  const result = buildProseModeGuidanceWithOverride(proseSource, proseMode)
  if (!result) return ""
  return `PROSE STYLE GUIDANCE:\n${result}`
}

function buildSaliencyGuidance(saliency: SaliencyMap): string {
  const parts: string[] = []
  if (saliency.activeCharacters.length > 0) {
    parts.push(`Active characters in scene: ${saliency.activeCharacters.join(", ")}`)
  }
  if (saliency.activeLocations.length > 0) {
    parts.push(`Active locations: ${saliency.activeLocations.join(", ")}`)
  }
  if (saliency.activePlotlines.length > 0) {
    parts.push(`Active plotlines: ${saliency.activePlotlines.join(", ")}`)
  }
  if (parts.length === 0) return ""
  return `SCENE SALIENCY (focus on these elements):\n${parts.join("\n")}`
}
