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

  let systemPrompt = `你是一名富有创造力的小说写作 AI 助手。你的任务是按照作者的自然语言指令编辑选中的文本。仅返回编辑后的文本——不要解释、不要引号、不要 markdown。`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `需要编辑的选中文本：\n"""${text}"""\n\n作者的编辑指令："${instruction}"\n\n周围上下文（仅供参考——不要将其包含在输出中）：\n${context.slice(-2000)}\n\n请仅返回编辑后的选中文本：`

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

  let systemPrompt = `你是一名专业的小说编辑。按照指令改写给定文本。仅返回改写后的文本——不要解释、不要元评论。`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  let instruction = ""
  switch (mode) {
    case "rephrase":
      instruction = "请改写这段文字，保持相同的含义和叙事意图，变换句式结构和用词。"
      break
    case "shorter":
      instruction = "请精简这段文字，删除多余的词语，收紧行文，同时保留核心含义。"
      break
    case "longer":
      instruction = "请扩展这段文字，添加更多细节、描写和层次，加入感官细节并加深情感共鸣。"
      break
    case "show-not-tell":
      instruction = "请用「展示而非告知」的技巧改写这段文字。将抽象的陈述替换为具体的动作、感官细节和对话。"
      break
    case "more-intense":
      instruction = "请将这段文字改写得更具情感冲击力和戏剧张力。增强紧张感、紧迫感或情感力度。"
      break
    case "more-lyrical":
      instruction = "请将这段文字改写为更优美、更有诗意的风格。运用节奏感、比喻和富有表现力的语言。"
      break
    case "custom":
      instruction = customInstructions || "请改进这段文字。"
      break
    default:
      instruction = "请改写这段文字，保持相同的含义。"
  }

  const userPrompt = `${instruction}\n\n原文：\n"${text}"\n\n改写后：`

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

  let systemPrompt = `你是一名专业的文本编辑。将给定文本精简至原文约50%的长度。保留核心含义、关键信息和原有风格，不要添加新内容。仅返回精简后的文本。`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `请将以下文本精简至大约50%的长度，保留含义和风格：\n\n${text}`

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
