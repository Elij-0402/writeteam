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
  const { text, projectId, documentId, proseMode, saliency } = body

  if (!text) {
    return Response.json({ error: "未选择文本" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId, user.id)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "shrink", proseMode, saliencyMap: saliency ?? null })

  let systemPrompt = `You are a skilled text editor. Condense the given text to approximately 50% of its original length. Preserve the core meaning, key information, and original style. Do not add new content. Return ONLY the condensed text.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Condense the following text to roughly 50% of its length while preserving meaning and style:\n\n${text}`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1000,
        temperature: 0.5,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "shrink",
        promptLog: userPrompt.slice(0, 500),
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
