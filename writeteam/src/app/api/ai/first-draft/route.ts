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

  const { outline, context, projectId, documentId, proseMode } = await request.json()

  if (!outline) {
    return Response.json({ error: "未提供大纲" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "first-draft", proseMode })

  let systemPrompt = `You are a professional fiction writer. Given an outline or scene beats, write a complete, polished first draft scene. Write vivid, engaging prose with dialogue, action, and description. Match the specified POV and tense. Do NOT include meta-commentary — just write the scene.`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `${context ? `Previous context:\n${context.slice(-2000)}\n\n` : ""}Write a complete first draft scene based on these beats/outline:\n\n${outline}\n\nWrite the full scene (800-1200 words) with rich prose, dialogue, and description:`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 2500,
        temperature: 0.85,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "first-draft",
        promptLog: outline.slice(0, 500),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
