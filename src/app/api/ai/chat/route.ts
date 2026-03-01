import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

interface ChatMessageInput {
  role: "user" | "assistant"
  content: string
}

interface ChatRequestBody {
  [key: string]: unknown
  messages?: unknown
  context?: unknown
  projectId?: unknown
  documentId?: unknown
  proseMode?: unknown
}

function isChatMessageArray(value: unknown): value is ChatMessageInput[] {
  if (!Array.isArray(value)) {
    return false
  }

  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false
    }

    const message = item as Record<string, unknown>
    return (
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
    )
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  let body: ChatRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求参数格式错误，请刷新后重试" }, { status: 400 })
  }

  const { messages, context, projectId, documentId, proseMode } = body
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

  if (!isChatMessageArray(messages) || messages.length === 0) {
    return Response.json({ error: "缺少有效对话消息，请重新发送后重试" }, { status: 400 })
  }

  let fullContext = ""
  try {
    const storyCtx = await fetchStoryContext(supabase, projectIdValue, user.id)
    const promptContext = buildStoryPromptContext(storyCtx, {
      feature: "chat",
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

  const systemPrompt = `You are a knowledgeable, creative AI writing assistant. You have access to the author's story information and current document. Help them brainstorm, solve plot problems, develop characters, and answer questions about their story. Be concise but insightful. When suggesting changes, be specific.
${fullContext ? `\n${fullContext}\n` : ""}
${contextValue ? `Current document context (last 3000 chars):\n${contextValue}\n` : ""}`

  const apiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ]

  const lastUserMessage = messages[messages.length - 1]?.content || ""

  try {
    return createOpenAIStreamResponse(
      {
        messages: apiMessages,
        maxTokens: 1000,
        temperature: 0.7,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId: projectIdValue,
        documentId: documentIdValue,
        feature: "chat",
        promptLog: lastUserMessage.slice(0, 500),
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json(
      {
        error: "AI 对话失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 }
    )
  }
}
