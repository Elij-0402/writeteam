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

  let systemPrompt = `你是一名富有创造力的小说写作 AI 助手。你的任务是从作者停笔的地方无缝续写故事。以自然、引人入胜的风格写作，匹配已有文本的行文风格。`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  let userPrompt = ""

  switch (mode) {
    case "guided":
      userPrompt = `按照以下方向续写故事："${guidance}"\n\n近期上下文：\n\n${context}\n\n请续写（约200-400字）：`
      break
    case "tone-ominous":
      userPrompt = `以阴沉、不祥的基调续写故事：\n\n${context}\n\n请以黑暗、悬疑的氛围续写（约200-400字）：`
      break
    case "tone-romantic":
      userPrompt = `以浪漫、温柔的基调续写故事：\n\n${context}\n\n请以温暖、情感丰沛的笔触续写（约200-400字）：`
      break
    case "tone-fast":
      userPrompt = `以快节奏、高能量的笔调续写故事：\n\n${context}\n\n请以紧迫感和推进力续写（约200-400字）：`
      break
    case "tone-humorous":
      userPrompt = `以机智幽默的笔调续写故事：\n\n${context}\n\n请以轻松、幽默的基调续写（约200-400字）：`
      break
    default: // auto
      userPrompt = `自然地续写故事：\n\n${context}\n\n请续写（约200-400字）：`
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

  let systemPrompt = `你是一名专业的小说作家。根据给定的大纲或场景节拍，撰写一个完整、精炼的初稿场景。写出生动、引人入胜的散文，包含对话、动作和描写。匹配指定的视角和时态。不要包含任何元评论——直接写场景。`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `${context ? `前文上下文：\n${context.slice(-2000)}\n\n` : ""}请根据以下节拍/大纲撰写完整的初稿场景：\n\n${outline}\n\n请写出完整的场景（800-1200字），包含丰富的散文描写、对话和细节：`

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

  let systemPrompt = `你是一名富有创造力的小说写作助手。你的任务是扩写给定段落，添加更多细节、描写、感官意象、内心活动和逐帧动作。放慢节奏，充实场景，但不改变情节方向。仅返回扩写后的散文。`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `请扩写以下段落，添加更多细节、描写和深度：\n\n"${text}"\n\n${context ? `故事上下文：\n${context.slice(-2000)}\n\n` : ""}请写出扩展版本（大约为原文的2-3倍长度），重点关注感官细节、人物内心和场景渲染：`

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

  let systemPrompt = `你是一名擅长感官描写的创意写作助手。给定一个词、短语或段落，按五感加比喻的方式生成生动的描写素材。用清晰的标题组织你的回答。`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `请为以下内容生成丰富的感官描写素材："${text}"

请按以下格式组织回答：

**视觉**：[视觉描写]
**听觉**：[听觉描写]
**嗅觉**：[嗅觉描写]
**触觉**：[触觉描写]
**味觉**：[味觉描写]
**比喻**：[创意比喻和象征]

每种感官提供2-3个选项，使描写生动且适合在小说中使用。`

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
