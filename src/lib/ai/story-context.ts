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
  return `作者规则（最高优先级——覆盖所有其他指导）：\n${aiRules}`
}

function buildGenreStyleGuidance(bible: StoryBibleData): string {
  if (!bible.genre && !bible.style) return ""

  const genrePart = bible.genre ? `${bible.genre}` : ""
  const stylePart = bible.style ? `，${bible.style}风格` : ""
  return `这是一部${genrePart}故事${stylePart}。`
}

function buildWritingParamsGuidance(bible: StoryBibleData): string {
  if (!bible.pov && !bible.tense) return ""

  const lines: string[] = ["严格写作参数（不可偏离）："]
  if (bible.pov) {
    lines.push(
      `- 叙事视角：${bible.pov}。始终保持此视角——不要滑入其他视角。`
    )
  }
  if (bible.tense) {
    lines.push(
      `- 时态：${bible.tense}。全文保持此时态——不要意外切换时态。`
    )
  }
  return lines.join("\n")
}

function buildToneGuidance(tone: string | null): string {
  if (!tone) return ""
  return `情感基调：${tone}。让此基调引导用词、节奏和氛围细节。`
}

function buildSynopsisGuidance(synopsis: string | null, contextLevel: ContextLevel): string {
  if (!synopsis) return ""
  if (contextLevel === "full") {
    return `故事梗概（用于叙事方向）：\n${synopsis}\n请据此保持故事连贯性并为后续事件埋下伏笔。`
  }
  return `故事梗概：\n${synopsis}`
}

function buildThemesGuidance(themes: string | null, contextLevel: ContextLevel): string {
  if (!themes) return ""
  if (contextLevel === "full") {
    return `需要编织的主题：${themes}\n通过意象、对话潜台词和角色选择来微妙地强化这些主题——不要直接点明。`
  }
  return `主题：${themes}`
}

function buildSettingGuidance(setting: string | null, contextLevel: ContextLevel): string {
  if (!setting) return ""
  if (contextLevel === "full") {
    return `故事场景：${setting}\n将场景扎根于此环境——使用与场景相关的感官细节、天气、建筑、声音和气味。`
  }
  return `故事场景：${setting}`
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
    return `世界规则（硬性约束——不可违反）：\n${sectionText}`
  } else if (sections.length === 1) {
    // Legacy flat text
    return `世界规则（硬性约束——不可违反）：\n${sections[0].content}\n所有叙事元素必须与这些既定规则保持一致。`
  }

  // Fallback
  const truncated = worldbuilding.slice(0, 2000)
  return `世界规则（硬性约束——不可违反）：\n${truncated}\n所有叙事元素必须与这些既定规则保持一致。`
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
    return `故事大纲（叙事路线图）：\n${outlineStr}\n请据此保持情节方向和节奏。`
  }
  return `故事大纲：\n${outlineStr}`
}

function buildBraindumpGuidance(braindump: string | null, contextLevel: ContextLevel): string {
  if (!braindump) return ""
  const truncated = braindump.slice(0, 1500)
  if (contextLevel === "full") {
    return `作者灵感池（创意种子）：\n${truncated}\n当灵感自然契合当前场景时，请从中汲取。`
  }
  return `作者灵感池：\n${truncated}`
}

function buildNotesGuidance(notes: string | null): string {
  if (!notes) return ""
  return `作者附加备注：\n${notes}\n请在适用的地方遵循这些指示。`
}

function buildCharacterGuidance(
  characters: CharacterData[],
  contextLevel: ContextLevel
): string {
  if (characters.length === 0) return ""
  if (contextLevel === "minimal") return ""

  const chars = characters.slice(0, 15)
  const lines: string[] = ["角色信息："]

  for (const c of chars) {
    const nameWithRole = c.role ? `${c.name}（${c.role}）` : c.name

    if (contextLevel === "full") {
      // Full context: all available fields
      const details: string[] = []
      if (c.description) details.push(c.description)
      if (c.appearance) details.push(`外貌：${c.appearance}`)
      if (c.personality) details.push(`性格：${c.personality}`)
      if (c.dialogue_style) details.push(`对话风格：${c.dialogue_style}`)
      if (c.backstory) details.push(`背景故事：${c.backstory}`)
      if (c.goals) details.push(`目标：${c.goals}`)
      if (c.relationships) details.push(`关系：${c.relationships}`)
      if (c.notes) details.push(`备注：${c.notes}`)
      lines.push(`- ${nameWithRole}${details.length > 0 ? "：" + details.join("。") + "。" : ""}`)
    } else {
      // Summary context: core identity fields (no appearance, backstory, notes)
      const details: string[] = []
      if (c.description) details.push(c.description)
      if (c.personality) details.push(`性格：${c.personality}`)
      if (c.goals) details.push(`目标：${c.goals}`)
      if (c.relationships) details.push(`关系：${c.relationships}`)
      if (c.dialogue_style) details.push(`对话风格：${c.dialogue_style}`)
      lines.push(`- ${nameWithRole}${details.length > 0 ? "：" + details.join("。") + "。" : ""}`)
    }
  }

  return lines.join("\n")
}

function buildCharacterVisibilityNotice(): string {
  return "角色上下文提示：\n角色上下文已关闭。若当前任务需要人物一致性，请在「AI 可见性控制」中开启「角色信息」后重试。"
}

function buildCharacterHealthGuidance(characters: CharacterData[]): string {
  if (characters.length === 0) {
    return "角色上下文提示：\n当前没有角色资料。若输出出现人物行为不一致，建议先在故事圣经中新增核心角色（姓名、定位、性格）后重试。"
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

  return `角色上下文提示：\n${notices.join("\n")}`
}

function buildProseModeSection(
  bible: StoryBibleData | null,
  proseMode: string | null
): string {
  const proseSource = bible ?? (proseMode ? { style: null, prose_mode: null, style_sample: null } : null)
  const result = buildProseModeGuidanceWithOverride(proseSource, proseMode)
  if (!result) return ""
  return `散文风格指导：\n${result}`
}

function buildSaliencyGuidance(saliency: SaliencyMap): string {
  const parts: string[] = []
  if (saliency.activeCharacters.length > 0) {
    parts.push(`场景中的活跃角色：${saliency.activeCharacters.join("、")}`)
  }
  if (saliency.activeLocations.length > 0) {
    parts.push(`活跃地点：${saliency.activeLocations.join("、")}`)
  }
  if (saliency.activePlotlines.length > 0) {
    parts.push(`活跃情节线：${saliency.activePlotlines.join("、")}`)
  }
  if (parts.length === 0) return ""
  return `场景焦点（重点关注以下元素）：\n${parts.join("\n")}`
}
