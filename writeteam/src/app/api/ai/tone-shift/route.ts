import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

const TONE_LABELS: Record<string, string> = {
  tense: "紧张",
  tender: "温柔",
  humorous: "幽默",
  melancholic: "悲伤",
  angry: "愤怒",
  mysterious: "神秘",
}

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
  const { text, tone, projectId, documentId, proseMode } = body

  const toneLabel = TONE_LABELS[tone] || tone

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "tone-shift", proseMode })

  let systemPrompt = `你是散文风格专家。将给定文本改写为${toneLabel}语调，保持内容和情节不变，只改变表达方式和措辞。`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `将以下文本改写为${toneLabel}语调：\n\n${text}`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1000,
        temperature: 0.7,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "tone-shift",
        promptLog: userPrompt.slice(0, 500),
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
