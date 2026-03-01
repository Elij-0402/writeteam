import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置" }, { status: 400 })
  }

  const body = await request.json()
  const { text, projectId, documentId } = body

  const storyCtx = await fetchStoryContext(supabase, projectId, user.id)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "describe" })

  let systemPrompt = `You are a creative writing assistant specializing in sensory description. Given a word, phrase, or passage, generate vivid descriptions organized by the five senses plus metaphors. Format your response clearly with headers for each sense.`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Generate rich, sensory descriptions for: "${text}"

Format your response like this:

**Sight**: [visual descriptions]
**Sound**: [auditory descriptions]
**Smell**: [olfactory descriptions]
**Touch**: [tactile descriptions]
**Taste**: [gustatory descriptions]
**Metaphor**: [creative metaphors and similes]

Make each description vivid and suitable for use in fiction. Provide 2-3 options per sense.`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 800,
        temperature: 0.9,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "describe",
        promptLog: text,
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
