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

  const { context, mode, guidance, projectId, documentId, proseMode } = await request.json()

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "write", proseMode })

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
    return createOpenAIStreamResponse(
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
        documentId: documentId || null,
        feature: "write",
        promptLog: userPrompt.slice(0, 500),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
