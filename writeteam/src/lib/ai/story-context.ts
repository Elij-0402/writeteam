import { SupabaseClient } from "@supabase/supabase-js"
import { buildProseModeGuidanceWithOverride } from "@/lib/ai/prose-mode"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export interface StoryBibleData {
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

export interface CharacterData {
  name: string
  role: string | null
  description: string | null
  personality: string | null
  appearance: string | null
  backstory: string | null
  goals: string | null
  relationships: string | null
  notes: string | null
}

export interface StoryContext {
  bible: StoryBibleData | null
  characters: CharacterData[]
}

export interface StoryPromptOptions {
  feature: AIFeature
  proseMode?: string | null // runtime override for prose mode
  saliencyMap?: SaliencyMap | null // saliency data for context-aware AI
}

export interface StoryPromptContext {
  fullContext: string // The complete formatted context to inject into system prompt
}

// ---------------------------------------------------------------------------
// Feature-group helpers
// ---------------------------------------------------------------------------

const WRITING_FEATURES: AIFeature[] = [
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
const PLANNING_FEATURES: AIFeature[] = ["scene-plan", "brainstorm", "twist", "muse"]
const CHECK_FEATURES: AIFeature[] = ["continuity-check"]

function isWritingFeature(f: AIFeature): boolean {
  return WRITING_FEATURES.includes(f)
}

function isPlanningFeature(f: AIFeature): boolean {
  return PLANNING_FEATURES.includes(f)
}

function isCheckFeature(f: AIFeature): boolean {
  return CHECK_FEATURES.includes(f)
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function fetchStoryContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<StoryContext> {
  // Fetch project-level data
  const [bibleResult, charsResult, projectResult] = await Promise.all([
    supabase
      .from("story_bibles")
      .select("*")
      .eq("project_id", projectId)
      .single(),
    supabase
      .from("characters")
      .select("*")
      .eq("project_id", projectId)
      .limit(15),
    supabase
      .from("projects")
      .select("series_id")
      .eq("id", projectId)
      .single(),
  ])

  if (bibleResult.error && bibleResult.error.code !== "PGRST116") {
    console.error("Failed to fetch story bible:", bibleResult.error)
  }
  if (charsResult.error) {
    console.error("Failed to fetch characters:", charsResult.error)
  }

  // Optionally fetch series bible if project belongs to a series
  let seriesBibleData: Record<string, unknown> | null = null
  const seriesId = projectResult.data?.series_id
  if (seriesId) {
    const { data: sb } = await supabase
      .from("series_bibles")
      .select("*")
      .eq("series_id", seriesId)
      .single()
    seriesBibleData = sb
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
        visibility: (bibleResult.data.visibility as Record<string, boolean>) ?? null,
      }
    : null

  // Merge series bible data into project bible (series data as fallback)
  if (seriesBibleData && bible) {
    if (!bible.genre && seriesBibleData.genre) bible.genre = seriesBibleData.genre as string
    if (!bible.style && seriesBibleData.style) bible.style = seriesBibleData.style as string
    if (!bible.themes && seriesBibleData.themes) bible.themes = seriesBibleData.themes as string
    if (!bible.setting && seriesBibleData.setting) bible.setting = seriesBibleData.setting as string
    if (!bible.worldbuilding && seriesBibleData.worldbuilding) bible.worldbuilding = seriesBibleData.worldbuilding as string
    if (!bible.notes && seriesBibleData.notes) bible.notes = seriesBibleData.notes as string
  }

  const characters: CharacterData[] = (charsResult.data ?? []).map(
    (c: Record<string, unknown>) => ({
      name: c.name as string,
      role: (c.role as string | null) ?? null,
      description: (c.description as string | null) ?? null,
      personality: (c.personality as string | null) ?? null,
      appearance: (c.appearance as string | null) ?? null,
      backstory: (c.backstory as string | null) ?? null,
      goals: (c.goals as string | null) ?? null,
      relationships: (c.relationships as string | null) ?? null,
      notes: (c.notes as string | null) ?? null,
    })
  )

  return { bible, characters }
}

// ---------------------------------------------------------------------------
// Prompt orchestration
// ---------------------------------------------------------------------------

export function buildStoryPromptContext(
  ctx: StoryContext,
  options: StoryPromptOptions
): StoryPromptContext {
  if (!ctx.bible && ctx.characters.length === 0) {
    return { fullContext: "" }
  }

  const { feature, proseMode, saliencyMap } = options
  const bible = ctx.bible
  const vis = bible?.visibility ?? {}

  // Helper: check if a field is visible (default true if not set)
  const isVisible = (field: string) => vis[field] !== false

  const sections: string[] = [
    buildAIRulesGuidance(bible?.ai_rules ?? null),
    bible && isVisible("genre") ? buildGenreStyleGuidance(bible, feature) : "",
    bible && isVisible("pov") ? buildWritingParamsGuidance(bible) : "",
    isVisible("tone") ? buildToneGuidance(bible?.tone ?? null) : "",
    isVisible("synopsis") ? buildSynopsisGuidance(bible?.synopsis ?? null, feature) : "",
    isVisible("themes") ? buildThemesGuidance(bible?.themes ?? null, feature) : "",
    isVisible("setting") ? buildSettingGuidance(bible?.setting ?? null, feature) : "",
    isVisible("worldbuilding") ? buildWorldbuildingGuidance(bible?.worldbuilding ?? null) : "",
    isVisible("outline") ? buildOutlineGuidance(bible?.outline ?? null, feature) : "",
    isVisible("braindump") ? buildBraindumpGuidance(bible?.braindump ?? null, feature) : "",
    isVisible("notes") ? buildNotesGuidance(bible?.notes ?? null) : "",
    isVisible("characters") ? buildCharacterGuidance(ctx.characters, feature) : "",
    buildProseModeSection(bible, proseMode ?? null),
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

function buildGenreStyleGuidance(
  bible: StoryBibleData,
  feature: AIFeature
): string {
  if (!bible.genre && !bible.style) return ""

  const genrePart = bible.genre ? `${bible.genre} ` : ""
  const stylePart = bible.style ? ` with ${bible.style} style` : ""
  const prefix = `This is a ${genrePart}story${stylePart}.`

  if (feature === "describe") {
    return `${prefix} Ground sensory descriptions in genre-appropriate imagery and atmosphere.`
  }
  if (isWritingFeature(feature)) {
    return `${prefix} Maintain genre conventions in pacing, atmosphere, and reader expectations.`
  }
  if (feature === "brainstorm") {
    return `${prefix} Generate ideas that fit genre conventions while offering fresh angles.`
  }
  if (feature === "scene-plan") {
    return `${prefix} Structure scenes with genre-appropriate pacing and tension patterns.`
  }
  if (feature === "continuity-check") {
    return `${prefix} Flag inconsistencies against genre conventions.`
  }
  if (feature === "chat") {
    return `${prefix} Consider genre conventions when advising.`
  }

  return prefix
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

function buildSynopsisGuidance(
  synopsis: string | null,
  feature: AIFeature
): string {
  if (!synopsis) return ""

  if (isWritingFeature(feature)) {
    return `STORY SYNOPSIS (for narrative direction):\n${synopsis}\nUse this to maintain story coherence and foreshadow upcoming events.`
  }
  if (feature === "brainstorm") {
    return `STORY SYNOPSIS (for context):\n${synopsis}\nGenerate ideas that connect to or extend this narrative.`
  }
  if (isCheckFeature(feature)) {
    return `STORY SYNOPSIS (ground truth):\n${synopsis}\nCheck the passage against these established facts.`
  }
  return `STORY SYNOPSIS:\n${synopsis}`
}

function buildThemesGuidance(
  themes: string | null,
  feature: AIFeature
): string {
  if (!themes) return ""

  if (isWritingFeature(feature)) {
    return `THEMES TO WEAVE: ${themes}\nSubtly reinforce these themes through imagery, dialogue subtext, and character choices \u2014 never state them explicitly.`
  }
  if (feature === "brainstorm") {
    return `THEMES: ${themes}\nGenerate ideas that explore or challenge these themes.`
  }
  if (isCheckFeature(feature)) {
    return `THEMES: ${themes}\nVerify thematic consistency.`
  }
  return `THEMES: ${themes}`
}

function buildSettingGuidance(
  setting: string | null,
  feature: AIFeature
): string {
  if (!setting) return ""

  if (
    feature === "write" ||
    feature === "expand" ||
    feature === "first-draft" ||
    feature === "describe"
  ) {
    return `SETTING: ${setting}\nGround scenes in this environment \u2014 use setting-specific sensory details, weather, architecture, sounds, and smells.`
  }
  if (feature === "scene-plan") {
    return `SETTING: ${setting}\nPlan scenes that leverage the setting for atmosphere and conflict.`
  }
  return `SETTING: ${setting}`
}

function buildWorldbuildingGuidance(worldbuilding: string | null): string {
  if (!worldbuilding) return ""
  const truncated = worldbuilding.slice(0, 2000)
  return `WORLD RULES (hard constraints \u2014 never violate):\n${truncated}\nAll narrative elements must be consistent with these established rules.`
}

function buildOutlineGuidance(
  outline: unknown | null,
  feature: AIFeature
): string {
  if (!outline) return ""

  let outlineStr: string
  if (typeof outline === "string") {
    outlineStr = outline
  } else {
    outlineStr = JSON.stringify(outline)
  }
  outlineStr = outlineStr.slice(0, 2000)

  if (isWritingFeature(feature)) {
    return `STORY OUTLINE (narrative roadmap):\n${outlineStr}\nUse this to maintain plot direction and pacing.`
  }
  if (feature === "scene-plan") {
    return `STORY OUTLINE (master plan):\n${outlineStr}\nPlan scenes that advance this outline.`
  }
  return `STORY OUTLINE:\n${outlineStr}`
}

function buildBraindumpGuidance(
  braindump: string | null,
  feature: AIFeature
): string {
  if (!braindump) return ""
  const truncated = braindump.slice(0, 1500)

  if (feature === "brainstorm") {
    return `AUTHOR'S INSPIRATION NOTES:\n${truncated}\nUse these raw ideas as creative seeds \u2014 riff on them, combine them, or take them in unexpected directions.`
  }
  if (isWritingFeature(feature)) {
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
  feature: AIFeature
): string {
  if (characters.length === 0) return ""

  const chars = characters.slice(0, 15)
  const lines: string[] = ["CHARACTERS:"]

  for (const c of chars) {
    const parts: string[] = []

    if (isWritingFeature(feature)) {
      // Writing features: name, role, description, appearance, personality
      parts.push(c.name)
      if (c.role) parts[0] = `${c.name} (${c.role})`
      const details: string[] = []
      if (c.description) details.push(c.description)
      if (c.appearance) details.push(`Appearance: ${c.appearance}`)
      if (c.personality) details.push(`Personality: ${c.personality}`)
      lines.push(`- ${parts[0]}: ${details.join(". ")}.`)
    } else if (isPlanningFeature(feature)) {
      // Planning features: name, role, goals, relationships, personality
      parts.push(c.name)
      if (c.role) parts[0] = `${c.name} (${c.role})`
      const details: string[] = []
      if (c.goals) details.push(`Goals: ${c.goals}`)
      if (c.relationships) details.push(`Relationships: ${c.relationships}`)
      if (c.personality) details.push(`Personality: ${c.personality}`)
      lines.push(`- ${parts[0]}: ${details.join(". ")}.`)
    } else if (isCheckFeature(feature)) {
      // Continuity-check: ALL fields
      parts.push(c.name)
      if (c.role) parts[0] = `${c.name} (${c.role})`
      const details: string[] = []
      if (c.description) details.push(`Description: ${c.description}`)
      if (c.appearance) details.push(`Appearance: ${c.appearance}`)
      if (c.personality) details.push(`Personality: ${c.personality}`)
      if (c.backstory) details.push(`Backstory: ${c.backstory}`)
      if (c.goals) details.push(`Goals: ${c.goals}`)
      if (c.relationships) details.push(`Relationships: ${c.relationships}`)
      if (c.notes) details.push(`Notes: ${c.notes}`)
      lines.push(`- ${parts[0]}: ${details.join(". ")}.`)
    } else {
      // Chat: name, role, description, personality, goals
      parts.push(c.name)
      if (c.role) parts[0] = `${c.name} (${c.role})`
      const details: string[] = []
      if (c.description) details.push(c.description)
      if (c.personality) details.push(`Personality: ${c.personality}`)
      if (c.goals) details.push(`Goals: ${c.goals}`)
      lines.push(`- ${parts[0]}: ${details.join(". ")}.`)
    }
  }

  // Append feature-specific footer
  if (isWritingFeature(feature)) {
    lines.push(
      "Write each character with a distinct voice reflecting their personality and background."
    )
  } else if (isCheckFeature(feature)) {
    lines.push(
      "Verify character actions and dialogue are consistent with their established traits."
    )
  }

  return lines.join("\n")
}

function buildProseModeSection(
  bible: StoryBibleData | null,
  proseMode: string | null
): string {
  const result = buildProseModeGuidanceWithOverride(bible, proseMode)
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
