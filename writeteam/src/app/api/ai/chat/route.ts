import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未授权访问" }, { status: 401 })
  }

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置" }, { status: 400 })
  }

  const { messages, context, projectId, documentId, proseMode } = await request.json()

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "chat", proseMode })

  const systemPrompt = `You are a knowledgeable, creative AI writing assistant. You have access to the author's story information and current document. Help them brainstorm, solve plot problems, develop characters, and answer questions about their story. Be concise but insightful. When suggesting changes, be specific.
${fullContext ? `\n${fullContext}\n` : ""}
${context ? `Current document context (last 3000 chars):\n${context}\n` : ""}`

  const apiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
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
        projectId,
        documentId: documentId || null,
        feature: "chat",
        promptLog: lastUserMessage.slice(0, 500),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
