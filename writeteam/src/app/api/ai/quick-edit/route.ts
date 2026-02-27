import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
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

  const { text, instruction, context, projectId, documentId, proseMode } = await request.json()

  if (!text || !instruction) {
    return Response.json({ error: "缺少选中文本或编辑指令" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "quick-edit", proseMode })

  let systemPrompt = `You are a creative fiction writing AI assistant. Your task is to edit the selected text according to the author's natural language instruction. Return ONLY the edited text — no explanations, no quotes, no markdown.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Selected text to edit:\n"""${text}"""\n\nAuthor's instruction: "${instruction}"\n\nSurrounding context (for reference only — do NOT include it in your output):\n${context?.slice(-2000) || ""}\n\nReturn the edited version of the selected text only:`

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1500,
        temperature: 0.7,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "quick-edit",
        promptLog: `Quick Edit: "${instruction}" on "${text.slice(0, 200)}"`,
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
