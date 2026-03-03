import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runStreamingPipeline } from "@/lib/ai/shared-pipeline"
import type { AIIntent } from "@/lib/ai/intent-config"

// ---------------------------------------------------------------------------
// Write intent types
// ---------------------------------------------------------------------------

type WriteMode = "auto" | "guided" | "tone-ominous" | "tone-romantic" | "tone-fast" | "tone-humorous"

type WriteRouteIntent = "write" | "first-draft" | "expand" | "describe"

function isWriteMode(value: unknown): value is WriteMode {
  return (
    value === "auto" ||
    value === "guided" ||
    value === "tone-ominous" ||
    value === "tone-romantic" ||
    value === "tone-fast" ||
    value === "tone-humorous"
  )
}

function isWriteRouteIntent(value: unknown): value is WriteRouteIntent {
  return (
    value === "write" ||
    value === "first-draft" ||
    value === "expand" ||
    value === "describe"
  )
}

// ---------------------------------------------------------------------------
// Per-intent message builders
// ---------------------------------------------------------------------------

function buildWriteMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const context = typeof body.context === "string" ? body.context : ""
  const guidance = typeof body.guidance === "string" ? body.guidance : ""
  const mode: WriteMode = isWriteMode(body.mode) ? body.mode : "auto"

  let systemPrompt = `You are a creative fiction writing AI assistant. Your task is to continue the story seamlessly from where the author left off. Write in a natural, engaging style that matches the existing prose.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  let userPrompt = ""

  switch (mode) {
    case "guided":
      userPrompt = `Continue the story based on this direction: "${guidance}"\n\nHere is the recent context:\n\n${context}\n\nContinue writing (about 200-400 words):`
      break
    case "tone-ominous":
      userPrompt = `Continue the story in an ominous, foreboding tone:\n\n${context}\n\nContinue writing with a dark, suspenseful atmosphere (about 200-400 words):`
      break
    case "tone-romantic":
      userPrompt = `Continue the story in a romantic, tender tone:\n\n${context}\n\nContinue writing with warmth and emotional depth (about 200-400 words):`
      break
    case "tone-fast":
      userPrompt = `Continue the story with fast-paced, high-energy prose:\n\n${context}\n\nContinue writing with urgency and momentum (about 200-400 words):`
      break
    case "tone-humorous":
      userPrompt = `Continue the story with wit and humor:\n\n${context}\n\nContinue writing with a light, humorous tone (about 200-400 words):`
      break
    default: // auto
      userPrompt = `Continue the story naturally:\n\n${context}\n\nContinue writing (about 200-400 words):`
      break
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

function buildFirstDraftMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const outline = typeof body.outline === "string" ? body.outline : ""
  const context = typeof body.context === "string" ? body.context : ""

  let systemPrompt = `You are a professional fiction writer. Given an outline or scene beats, write a complete, polished first draft scene. Write vivid, engaging prose with dialogue, action, and description. Match the specified POV and tense. Do NOT include meta-commentary — just write the scene.`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `${context ? `Previous context:\n${context.slice(-2000)}\n\n` : ""}Write a complete first draft scene based on these beats/outline:\n\n${outline}\n\nWrite the full scene (800-1200 words) with rich prose, dialogue, and description:`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

function buildExpandMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const text = typeof body.text === "string" ? body.text : ""
  const context = typeof body.context === "string" ? body.context : ""

  let systemPrompt = `You are a creative fiction writing assistant. Your task is to expand the given passage by adding more detail, description, sensory imagery, internal thoughts, and moment-to-moment action. Slow down the pacing and flesh out the scene without changing the plot direction. Return ONLY the expanded prose.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Expand this passage with more detail, description, and depth:\n\n"${text}"\n\n${context ? `Story context:\n${context.slice(-2000)}\n\n` : ""}Write an expanded version (roughly 2-3x the original length). Focus on sensory details, character interiority, and scene-setting:`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

function buildDescribeMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const text = typeof body.text === "string" ? body.text : ""

  let systemPrompt = `You are a creative writing assistant specializing in sensory description. Given a word, phrase, or passage, generate vivid descriptions organized by the five senses plus metaphors. Format your response clearly with headers for each sense.`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Generate rich, sensory descriptions for: "${text}"

Format your response like this:

**Sight**: [visual descriptions]
**Sound**: [auditory descriptions]
**Smell**: [olfactory descriptions]
**Touch**: [tactile descriptions]
**Taste**: [gustatory descriptions]
**Metaphor**: [creative metaphors and similes]

Make each description vivid and suitable for use in fiction. Provide 2-3 options per sense.`

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
  let intent: WriteRouteIntent = "write"
  try {
    const peek = await request.clone().json()
    if (isWriteRouteIntent(peek.intent)) {
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
        case "first-draft":
          return buildFirstDraftMessages(body, fullContext)
        case "expand":
          return buildExpandMessages(body, fullContext)
        case "describe":
          return buildDescribeMessages(body, fullContext)
        default:
          return buildWriteMessages(body, fullContext)
      }
    },
  })
}
