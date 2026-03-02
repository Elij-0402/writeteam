import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { runConsistencyPreflight } from "@/lib/ai/consistency-preflight"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import type { SaliencyMap } from "@/lib/ai/story-context"

interface WriteRequestBody {
  [key: string]: unknown
  context?: unknown
  mode?: unknown
  guidance?: unknown
  projectId?: unknown
  documentId?: unknown
  proseMode?: unknown
  saliency?: unknown
}

type WriteMode = "auto" | "guided" | "tone-ominous" | "tone-romantic" | "tone-fast" | "tone-humorous"

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

function isSaliencyMap(value: unknown): value is SaliencyMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.activeCharacters) &&
    Array.isArray(v.activeLocations) &&
    Array.isArray(v.activePlotlines) &&
    v.activeCharacters.every((item) => typeof item === "string") &&
    v.activeLocations.every((item) => typeof item === "string") &&
    v.activePlotlines.every((item) => typeof item === "string")
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置" }, { status: 400 })
  }

  let body: WriteRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求参数格式错误，请刷新后重试" }, { status: 400 })
  }

  const projectId =
    typeof body.projectId === "string" && body.projectId.trim().length > 0 ? body.projectId.trim() : null
  if (!projectId) {
    return Response.json({ error: "缺少项目ID，请返回项目后重试" }, { status: 400 })
  }

  const context = typeof body.context === "string" ? body.context : null
  if (!context || context.trim().length === 0) {
    return Response.json({ error: "缺少上下文，请输入内容后重试" }, { status: 400 })
  }

  const guidance = typeof body.guidance === "string" ? body.guidance : ""
  const mode: WriteMode = isWriteMode(body.mode) ? body.mode : "auto"
  const documentId =
    typeof body.documentId === "string" && body.documentId.trim().length > 0 ? body.documentId.trim() : null
  const proseMode = typeof body.proseMode === "string" ? body.proseMode : null
  const saliency = isSaliencyMap(body.saliency) ? body.saliency : null

  const storyCtx = await fetchStoryContext(supabase, projectId, user.id)
  const preflight = runConsistencyPreflight({
    text: `${context}\n${guidance}`,
    consistencyState: storyCtx.consistencyState,
  })
  if (preflight.shouldBlock) {
    return Response.json(
      {
        error: "检测到高风险设定冲突，请先修正后再试",
        errorType: "consistency_high_risk",
        severity: "high",
        violations: preflight.violations,
      },
      { status: 409 }
    )
  }

  const { fullContext } = buildStoryPromptContext(storyCtx, {
    feature: "write",
    proseMode,
    saliencyMap: saliency,
  })

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

  try {
      return await createOpenAIStreamResponse(
        {
          messages: [
            { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1000,
        temperature: 0.8,
        ...aiConfig,
      },
        {
          supabase,
          userId: user.id,
          projectId,
          documentId,
          feature: "write",
          promptLog: userPrompt.slice(0, 500),
          ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
