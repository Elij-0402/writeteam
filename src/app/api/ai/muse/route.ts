import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

type MuseMode = "what-if" | "random-prompt" | "suggest"

interface MuseRequestBody {
  [key: string]: unknown
  mode?: unknown
  projectId?: unknown
  documentId?: unknown
  context?: unknown
  input?: unknown
  proseMode?: unknown
}

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

  let body: MuseRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求参数格式错误，请刷新后重试" }, { status: 400 })
  }

  const { mode, projectId, documentId, context, input, proseMode } = body
  const projectIdValue = typeof projectId === "string" ? projectId.trim() : ""
  const documentIdValue =
    typeof documentId === "string" && documentId.trim().length > 0 ? documentId.trim() : null
  const contextValue = typeof context === "string" ? context : ""
  const inputValue = typeof input === "string" ? input : ""
  const proseModeValue = typeof proseMode === "string" ? proseMode : null

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置，请先在设置中配置模型后重试" }, { status: 400 })
  }

  if (!projectIdValue) {
    return Response.json({ error: "缺少项目ID，请返回项目后重试" }, { status: 400 })
  }

  if (typeof mode !== "string" || !["what-if", "random-prompt", "suggest"].includes(mode)) {
    return Response.json({ error: "无效的灵感模式" }, { status: 400 })
  }

  const museMode = mode as MuseMode

  const storyCtx = await fetchStoryContext(supabase, projectIdValue, user.id)
  const { fullContext: storyContext } = buildStoryPromptContext(storyCtx, {
    feature: "muse",
    proseMode: proseModeValue,
  })

  let systemPrompt = MUSE_SYSTEM_PROMPTS[museMode]
  if (storyContext) {
    systemPrompt += `\n\n${storyContext}`
  }

  let userPrompt = ""
  switch (museMode) {
    case "what-if":
      userPrompt = inputValue
        ? `Based on this story context and the author's specific question, generate "what if" scenarios.\n\nAuthor's question: ${inputValue}\n\nRecent story text:\n${contextValue || "(no text provided)"}`
        : `Based on the story context, generate surprising "what if" scenarios that could take the story in new directions.\n\nRecent story text:\n${contextValue || "(no text provided)"}`
      break
    case "random-prompt":
      userPrompt = contextValue
        ? `Generate creative writing prompts inspired by this story world and its characters.\n\nRecent story text:\n${contextValue}`
        : `Generate vivid, evocative creative writing prompts for fiction writing.`
      break
    case "suggest":
      userPrompt = `Analyze this text and suggest concrete next directions for the story.\n\nCurrent text:\n${contextValue || "(no text provided)"}`
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
        projectId: projectIdValue,
        documentId: documentIdValue,
        feature: "muse",
        promptLog: `[Muse: ${museMode}] ${userPrompt.slice(0, 400)}`,
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json(
      {
        error: "灵感生成失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 }
    )
  }
}
