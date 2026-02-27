import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

type MuseMode = "what-if" | "random-prompt" | "suggest"

const MUSE_SYSTEM_PROMPTS: Record<MuseMode, string> = {
  "what-if": `You are a wildly creative fiction muse. Your role is to generate fascinating "what if" scenarios that could take the story in unexpected, thrilling directions. Think beyond the obvious — surprise the author with bold, imaginative possibilities that still feel organic to the story world. Present 3-5 "what if" scenarios, each as a short, evocative paragraph. Number them clearly. Write in the language that matches the story context (default to 简体中文 if unclear).`,

  "random-prompt": `You are an inspirational creative writing muse. Generate 5 vivid, evocative writing prompts that could spark new scenes, characters, or plot developments. Each prompt should be a single compelling sentence that ignites the imagination — think sensory details, emotional hooks, and intriguing situations. Number them clearly. Make them diverse in tone and scope. Write in the language that matches the story context (default to 简体中文 if unclear).`,

  "suggest": `You are a perceptive story analyst and creative advisor. Analyze the current text carefully and suggest 3-5 concrete next directions the story could take. For each suggestion, explain briefly why it would work narratively (tension, character development, thematic resonance, etc.). Be specific — reference actual elements from the text. Number them clearly. Write in the language that matches the story context (default to 简体中文 if unclear).`,
}

const MUSE_TEMPERATURES: Record<MuseMode, number> = {
  "what-if": 0.9,
  "random-prompt": 0.95,
  "suggest": 0.85,
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
  const { mode, projectId, documentId, context, input } = body

  if (!mode || !["what-if", "random-prompt", "suggest"].includes(mode)) {
    return Response.json({ error: "无效的灵感模式" }, { status: 400 })
  }

  const museMode = mode as MuseMode

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext: storyContext } = buildStoryPromptContext(storyCtx, {
    feature: "muse",
  })

  let systemPrompt = MUSE_SYSTEM_PROMPTS[museMode]
  if (storyContext) {
    systemPrompt += `\n\n${storyContext}`
  }

  let userPrompt = ""
  switch (museMode) {
    case "what-if":
      userPrompt = input
        ? `Based on this story context and the author's specific question, generate "what if" scenarios.\n\nAuthor's question: ${input}\n\nRecent story text:\n${context || "(no text provided)"}`
        : `Based on the story context, generate surprising "what if" scenarios that could take the story in new directions.\n\nRecent story text:\n${context || "(no text provided)"}`
      break
    case "random-prompt":
      userPrompt = context
        ? `Generate creative writing prompts inspired by this story world and its characters.\n\nRecent story text:\n${context}`
        : `Generate vivid, evocative creative writing prompts for fiction writing.`
      break
    case "suggest":
      userPrompt = `Analyze this text and suggest concrete next directions for the story.\n\nCurrent text:\n${context || "(no text provided)"}`
      break
  }

  try {
    return createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1200,
        temperature: MUSE_TEMPERATURES[museMode],
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId,
        documentId: documentId || null,
        feature: "muse",
        promptLog: `[Muse: ${museMode}] ${userPrompt.slice(0, 400)}`,
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
