import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

interface BrainstormRequestBody {
  [key: string]: unknown
  topic?: unknown
  context?: unknown
  projectId?: unknown
  documentId?: unknown
  proseMode?: unknown
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  let body: BrainstormRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求参数格式错误，请刷新后重试" }, { status: 400 })
  }

  const { topic, context, projectId, documentId, proseMode } = body
  const projectIdValue = typeof projectId === "string" ? projectId.trim() : ""
  const topicValue = typeof topic === "string" ? topic.trim() : ""
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

  if (!topicValue) {
    return Response.json({ error: "缺少头脑风暴主题，请输入主题后重试" }, { status: 400 })
  }

  let fullContext = ""
  try {
    const storyCtx = await fetchStoryContext(supabase, projectIdValue, user.id)
    const promptContext = buildStoryPromptContext(storyCtx, {
      feature: "brainstorm",
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

  let systemPrompt = `You are a creative brainstorming partner for fiction writers. Generate unique, interesting, and diverse ideas. Be creative and unexpected. Format each idea as a numbered list item with a brief explanation.`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Brainstorm 8-10 creative ideas for: "${topicValue}"

${contextValue ? `Story context for reference:\n${contextValue.slice(-1000)}\n\n` : ""}Generate diverse, interesting options. For each idea, provide the idea itself and a one-sentence explanation of why it's interesting or how it could be used.`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1000,
        temperature: 1.0,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId: projectIdValue,
        documentId: documentIdValue,
        feature: "brainstorm",
        promptLog: topicValue.slice(0, 500),
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json(
      {
        error: "头脑风暴生成失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 }
    )
  }
}
