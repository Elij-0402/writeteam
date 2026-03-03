import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runStreamingPipeline } from "@/lib/ai/shared-pipeline"
import type { AIIntent } from "@/lib/ai/intent-config"

// ---------------------------------------------------------------------------
// Edit intent types
// ---------------------------------------------------------------------------

type EditRouteIntent = "quick-edit" | "rewrite" | "shrink" | "tone-shift"

function isEditRouteIntent(value: unknown): value is EditRouteIntent {
  return (
    value === "quick-edit" ||
    value === "rewrite" ||
    value === "shrink" ||
    value === "tone-shift"
  )
}

// ---------------------------------------------------------------------------
// Rewrite mode constants
// ---------------------------------------------------------------------------

type RewriteMode =
  | "rephrase"
  | "shorter"
  | "longer"
  | "show-not-tell"
  | "more-intense"
  | "more-lyrical"
  | "custom"

function isRewriteMode(value: unknown): value is RewriteMode {
  return (
    value === "rephrase" ||
    value === "shorter" ||
    value === "longer" ||
    value === "show-not-tell" ||
    value === "more-intense" ||
    value === "more-lyrical" ||
    value === "custom"
  )
}

// ---------------------------------------------------------------------------
// Tone-shift labels
// ---------------------------------------------------------------------------

const TONE_LABELS: Record<string, string> = {
  tense: "紧张",
  tender: "温柔",
  humorous: "幽默",
  melancholic: "悲伤",
  angry: "愤怒",
  mysterious: "神秘",
}

// ---------------------------------------------------------------------------
// Per-intent message builders
// ---------------------------------------------------------------------------

function buildQuickEditMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const text = typeof body.text === "string" ? body.text : ""
  const instruction = typeof body.instruction === "string" ? body.instruction : ""
  const context = typeof body.context === "string" ? body.context : ""

  let systemPrompt = `You are a creative fiction writing AI assistant. Your task is to edit the selected text according to the author's natural language instruction. Return ONLY the edited text — no explanations, no quotes, no markdown.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Selected text to edit:\n"""${text}"""\n\nAuthor's instruction: "${instruction}"\n\nSurrounding context (for reference only — do NOT include it in your output):\n${context.slice(-2000)}\n\nReturn the edited version of the selected text only:`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

function buildRewriteMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const text = typeof body.text === "string" ? body.text : ""
  const mode: RewriteMode = isRewriteMode(body.mode) ? body.mode : "rephrase"
  const customInstructions = typeof body.customInstructions === "string" ? body.customInstructions : ""

  let systemPrompt = `You are a skilled fiction editor. Rewrite the given text according to the instructions. Return ONLY the rewritten text — no explanations, no meta-commentary.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  let instruction = ""
  switch (mode) {
    case "rephrase":
      instruction = "Rephrase this passage while keeping the same meaning and narrative intent. Vary the sentence structure and word choice."
      break
    case "shorter":
      instruction = "Make this passage more concise. Remove unnecessary words and tighten the prose while preserving the essential meaning."
      break
    case "longer":
      instruction = "Expand this passage with more detail, description, and nuance. Add sensory details and deepen the emotional resonance."
      break
    case "show-not-tell":
      instruction = "Rewrite this passage using 'show, don't tell' techniques. Replace abstract statements with concrete actions, sensory details, and dialogue."
      break
    case "more-intense":
      instruction = "Rewrite this passage to be more emotionally intense and dramatic. Heighten the tension, urgency, or emotional impact."
      break
    case "more-lyrical":
      instruction = "Rewrite this passage in a more lyrical, poetic style. Use rhythm, metaphor, and evocative language."
      break
    case "custom":
      instruction = customInstructions || "Improve this passage."
      break
    default:
      instruction = "Rephrase this passage while keeping the same meaning."
  }

  const userPrompt = `${instruction}\n\nOriginal text:\n"${text}"\n\nRewritten text:`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

function buildShrinkMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const text = typeof body.text === "string" ? body.text : ""

  let systemPrompt = `You are a skilled text editor. Condense the given text to approximately 50% of its original length. Preserve the core meaning, key information, and original style. Do not add new content. Return ONLY the condensed text.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Condense the following text to roughly 50% of its length while preserving meaning and style:\n\n${text}`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

function buildToneShiftMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const text = typeof body.text === "string" ? body.text : ""
  const tone = typeof body.tone === "string" ? body.tone : ""
  const toneLabel = TONE_LABELS[tone] || tone

  let systemPrompt = `你是散文风格专家。将给定文本改写为${toneLabel}语调，保持内容和情节不变，只改变表达方式和措辞。`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `将以下文本改写为${toneLabel}语调：\n\n${text}`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Pre-parse body to extract intent before handing off to pipeline.
  // We clone so the pipeline can re-parse the body independently.
  let intent: EditRouteIntent = "quick-edit"
  try {
    const peek = await request.clone().json()
    if (isEditRouteIntent(peek.intent)) {
      intent = peek.intent
    }
  } catch {
    // Body parse will fail again inside the pipeline, which returns 400.
  }

  return runStreamingPipeline({
    supabase,
    request,
    intent: intent as AIIntent,
    buildMessages({ body, fullContext }) {
      switch (intent) {
        case "rewrite":
          return buildRewriteMessages(body, fullContext)
        case "shrink":
          return buildShrinkMessages(body, fullContext)
        case "tone-shift":
          return buildToneShiftMessages(body, fullContext)
        default:
          return buildQuickEditMessages(body, fullContext)
      }
    },
  })
}
