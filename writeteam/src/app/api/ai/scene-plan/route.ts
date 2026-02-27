import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
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

  const body = await request.json()
  const { goal, context, projectId, documentId, proseMode } = body

  if (!goal) {
    return Response.json({ error: "未提供场景规划目标" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "scene-plan", proseMode })

  let systemPrompt =
    "You are an expert fiction story architect. Break chapter goals into scene-by-scene plans. Ensure rising tension, cause-effect continuity, and clear scene purpose. Return only the plan."
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `${context ? `Recent manuscript context:\n${context.slice(-2500)}\n\n` : ""}Create a scene plan for this chapter goal:\n${goal}\n\nOutput format:\n1) Scene Title\n- Purpose\n- POV\n- Conflict\n- Beat List (3-6 beats)\n- Exit Hook`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1800,
        temperature: 0.7,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "scene-plan",
        promptLog: goal.slice(0, 500),
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
