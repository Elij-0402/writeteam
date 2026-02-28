import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

interface TwistRequestBody {
  [key: string]: unknown
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

  let body: TwistRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求参数格式错误，请刷新后重试" }, { status: 400 })
  }

  const { context, projectId, documentId, proseMode } = body
  const projectIdValue = typeof projectId === "string" ? projectId.trim() : ""
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

  if (!contextValue.trim()) {
    return Response.json({ error: "缺少上下文文本，请提供当前段落后重试" }, { status: 400 })
  }

  let fullContext = ""
  try {
    const storyCtx = await fetchStoryContext(supabase, projectIdValue, user.id)
    const promptContext = buildStoryPromptContext(storyCtx, {
      feature: "twist",
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

  let systemPrompt = `你是创意写作顾问。基于给定的故事上下文，生成3-5个出人意料但合理的情节反转建议。每个反转用"## 反转N: [标题]"格式，包含反转描述和对后续剧情的影响。`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `基于以下内容生成情节反转建议：\n\n${contextValue}`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1500,
        temperature: 0.9,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId: projectIdValue,
        documentId: documentIdValue,
        feature: "twist",
        promptLog: userPrompt.slice(0, 500),
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json(
      {
        error: "情节反转生成失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 }
    )
  }
}
