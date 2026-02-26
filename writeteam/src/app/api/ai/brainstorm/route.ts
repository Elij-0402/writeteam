import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未授权访问" }, { status: 401 })
  }

  const { topic, context, projectId, documentId } = await request.json()

  if (!topic) {
    return Response.json({ error: "未提供主题" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "brainstorm" })

  let systemPrompt = `You are a creative brainstorming partner for fiction writers. Generate unique, interesting, and diverse ideas. Be creative and unexpected. Format each idea as a numbered list item with a brief explanation.`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Brainstorm 8-10 creative ideas for: "${topic}"

${context ? `Story context for reference:\n${context.slice(-1000)}\n\n` : ""}Generate diverse, interesting options. For each idea, provide the idea itself and a one-sentence explanation of why it's interesting or how it could be used.`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1000,
        temperature: 1.0,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "brainstorm",
        promptLog: topic,
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
