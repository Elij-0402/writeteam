import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置" }, { status: 400 })
  }

  const { passage, context, projectId, documentId } = await request.json()

  if (!passage) {
    return Response.json({ error: "未提供待检查段落" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "continuity-check" })

  let systemPrompt =
    "You are a strict fiction continuity editor. Find contradictions, logic gaps, timeline issues, POV drift, and character inconsistency. Output concise diagnostics and fixes."
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `${context ? `Recent chapter context:\n${context.slice(-2500)}\n\n` : ""}Check this passage for continuity issues:\n\n${passage}\n\nOutput format:\n- Issue\n- Why it conflicts\n- Suggested fix\nIf no issues, output: No continuity issues found.`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1200,
        temperature: 0.3,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "continuity-check",
        promptLog: passage.slice(0, 500),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
