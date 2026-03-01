import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

interface ScenePlanRequestBody {
  [key: string]: unknown
  goal?: unknown
  context?: unknown
  projectId?: unknown
  documentId?: unknown
  proseMode?: unknown
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  let body: ScenePlanRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求参数格式错误，请刷新后重试" }, { status: 400 })
  }

  const { goal, context, projectId, documentId, proseMode } = body
  const projectIdValue = typeof projectId === "string" ? projectId.trim() : ""
  const goalValue = typeof goal === "string" ? goal.trim() : ""
  const contextValue = typeof context === "string" ? context : ""
  const proseModeValue = typeof proseMode === "string" ? proseMode : null
  const documentIdValue =
    typeof documentId === "string" && documentId.trim().length > 0 ? documentId.trim() : null

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置，请先在设置中配置模型后重试" }, { status: 400 })
  }

  if (!projectIdValue) {
    return Response.json({ error: "缺少项目ID，请返回项目后重试" }, { status: 400 })
  }

  if (!goalValue) {
    return Response.json({ error: "缺少场景规划目标，请输入目标后重试" }, { status: 400 })
  }

  let fullContext = ""
  try {
    const storyCtx = await fetchStoryContext(supabase, projectIdValue, user.id)
    const promptContext = buildStoryPromptContext(storyCtx, {
      feature: "scene-plan",
      proseMode: proseModeValue,
    })
    fullContext = promptContext.fullContext
  } catch {
    return Response.json(
      {
        error: "上下文加载失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 }
    )
  }

  let systemPrompt =
    "You are an expert fiction story architect. Break chapter goals into scene-by-scene plans. Ensure rising tension, cause-effect continuity, and clear scene purpose. Return only the plan."
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `${contextValue ? `Recent manuscript context:\n${contextValue.slice(-2500)}\n\n` : ""}Create a scene plan for this chapter goal:\n${goalValue}\n\nOutput format:\n1) Scene Title\n- Purpose\n- POV\n- Conflict\n- Beat List (3-6 beats)\n- Exit Hook`

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
        projectId: projectIdValue,
        documentId: documentIdValue,
        feature: "scene-plan",
        promptLog: goalValue.slice(0, 500),
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json(
      {
        error: "场景规划生成失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 }
    )
  }
}
