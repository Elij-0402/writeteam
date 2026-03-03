import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runStreamingPipeline, validateAndResolve } from "@/lib/ai/shared-pipeline"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import type { AIIntent } from "@/lib/ai/intent-config"

// ---------------------------------------------------------------------------
// Chat intent types
// ---------------------------------------------------------------------------

type ChatRouteIntent = "chat" | "brainstorm" | "twist" | "muse" | "bible-assist"

function isChatRouteIntent(value: unknown): value is ChatRouteIntent {
  return (
    value === "chat" ||
    value === "brainstorm" ||
    value === "twist" ||
    value === "muse" ||
    value === "bible-assist"
  )
}

// ---------------------------------------------------------------------------
// Chat multi-turn message validation
// ---------------------------------------------------------------------------

interface ChatMessageInput {
  role: "user" | "assistant"
  content: string
}

function isChatMessageArray(value: unknown): value is ChatMessageInput[] {
  if (!Array.isArray(value)) {
    return false
  }

  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false
    }

    const message = item as Record<string, unknown>
    return (
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
    )
  })
}

// ---------------------------------------------------------------------------
// Muse mode types and prompts
// ---------------------------------------------------------------------------

type MuseMode = "what-if" | "random-prompt" | "suggest"

const MUSE_SYSTEM_PROMPTS: Record<MuseMode, string> = {
  "what-if": `You are a wildly creative fiction muse. Your role is to generate fascinating "what if" scenarios that could take the story in unexpected, thrilling directions. Think beyond the obvious — surprise the author with bold, imaginative possibilities that still feel organic to the story world. Present 3-5 "what if" scenarios, each as a short, evocative paragraph. Number them clearly. Write in the language that matches the story context (default to 简体中文 if unclear).`,

  "random-prompt": `You are an inspirational creative writing muse. Generate 5 vivid, evocative writing prompts that could spark new scenes, characters, or plot developments. Each prompt should be a single compelling sentence that ignites the imagination — think sensory details, emotional hooks, and intriguing situations. Number them clearly. Make them diverse in tone and scope. Write in the language that matches the story context (default to 简体中文 if unclear).`,

  "suggest": `You are a perceptive story analyst and creative advisor. Analyze the current text carefully and suggest 3-5 concrete next directions the story could take. For each suggestion, explain briefly why it would work narratively (tension, character development, thematic resonance, etc.). Be specific — reference actual elements from the text. Number them clearly. Write in the language that matches the story context (default to 简体中文 if unclear).`,
}

// ---------------------------------------------------------------------------
// Bible-assist mode types and prompts
// ---------------------------------------------------------------------------

type BibleAssistMode =
  | "field-generate"
  | "braindump-expand"
  | "document-extract"
  | "character-generate"

const VALID_BIBLE_MODES: BibleAssistMode[] = [
  "field-generate",
  "braindump-expand",
  "document-extract",
  "character-generate",
]

const FIELD_PROMPTS: Record<string, string> = {
  genre:
    "根据已有的故事信息，推荐最适合的文体类型（如都市悬疑、奇幻冒险等），用简短的词组回答。",
  style:
    "根据故事类型和内容，建议合适的写作风格（如紧凑明快、细腻文学等），用简短描述回答。",
  synopsis:
    "根据已有的角色、世界观和其他信息，写一段 200-400 字的故事梗概。",
  themes:
    "根据故事内容，提炼 2-4 个核心主题，每个主题用一个短语描述。",
  setting:
    "根据故事类型和世界观，描述故事的主要场景、时代和地理环境，150-300 字。",
  tone: "根据故事类型和内容，建议整体情绪基调（如压抑、温暖、紧张等），用简短词组回答。",
  worldbuilding:
    "根据已有信息，构建世界设定，包括地理环境、势力关系、能力体系和社会规则。300-500 字。",
  personality:
    "根据角色的描述和背景，生成这个角色的核心性格特征描述。100-200 字。",
  backstory:
    "根据角色信息和故事背景，为这个角色编写合理的背景故事。150-300 字。",
  goals: "根据角色的性格和故事情节，描述这个角色的短期目标和终极追求。",
  dialogue_style:
    "根据角色的性格和背景，描述这个角色的说话特点、口头禅和语气风格。",
  description:
    "根据角色名字和其他信息，写一段角色的简要描述。50-100 字。",
  appearance: "根据角色信息，描述这个角色的外貌特征。50-100 字。",
  relationships:
    "根据已有的角色列表和故事背景，描述这个角色与其他角色的关系。",
}

// ---------------------------------------------------------------------------
// Per-intent message builders
// ---------------------------------------------------------------------------

function buildChatMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages = body.messages as ChatMessageInput[]
  const contextValue = typeof body.context === "string" ? body.context : ""

  const systemPrompt = `You are a knowledgeable, creative AI writing assistant. You have access to the author's story information and current document. Help them brainstorm, solve plot problems, develop characters, and answer questions about their story. Be concise but insightful. When suggesting changes, be specific.
${fullContext ? `\n${fullContext}\n` : ""}
${contextValue ? `Current document context (last 3000 chars):\n${contextValue}\n` : ""}`

  return [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ]
}

function buildBrainstormMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const topicValue = typeof body.topic === "string" ? body.topic.trim() : ""
  const contextValue = typeof body.context === "string" ? body.context : ""

  let systemPrompt = `You are a creative brainstorming partner for fiction writers. Generate unique, interesting, and diverse ideas. Be creative and unexpected. Format each idea as a numbered list item with a brief explanation.`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Brainstorm 8-10 creative ideas for: "${topicValue}"

${contextValue ? `Story context for reference:\n${contextValue.slice(-1000)}\n\n` : ""}Generate diverse, interesting options. For each idea, provide the idea itself and a one-sentence explanation of why it's interesting or how it could be used.`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

function buildTwistMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const contextValue = typeof body.context === "string" ? body.context : ""

  let systemPrompt = `你是创意写作顾问。基于给定的故事上下文，生成3-5个出人意料但合理的情节反转建议。每个反转用"## 反转N: [标题]"格式，包含反转描述和对后续剧情的影响。`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `基于以下内容生成情节反转建议：\n\n${contextValue}`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

function buildMuseMessages(
  body: Record<string, unknown>,
  fullContext: string,
): Array<{ role: "system" | "user"; content: string }> {
  const museMode = body.mode as MuseMode
  const contextValue = typeof body.context === "string" ? body.context : ""
  const inputValue = typeof body.input === "string" ? body.input : ""

  let systemPrompt = MUSE_SYSTEM_PROMPTS[museMode]
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
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

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]
}

function buildBibleAssistMessages(
  body: Record<string, unknown>,
  fullContext: string,
  storyCtx: Awaited<ReturnType<typeof fetchStoryContext>>,
): Array<{ role: "system" | "user"; content: string }> {
  const modeValue = body.mode as BibleAssistMode
  const { targetField, currentBible, documentTexts } = body

  let systemPrompt: string
  let userPrompt: string

  switch (modeValue) {
    case "field-generate": {
      const targetFieldValue =
        typeof targetField === "string" ? targetField.trim() : ""
      const fieldInstruction =
        FIELD_PROMPTS[targetFieldValue] ||
        `为「${targetFieldValue}」字段生成合适的内容。`
      systemPrompt = `你是一个专业的小说创作助手。根据已有的故事圣经信息，为作者生成指定字段的建议内容。\n\n${fullContext}\n\n注意：直接输出建议内容，不要加任何解释或前缀。用中文回答。`
      userPrompt = fieldInstruction
      if (
        currentBible &&
        typeof currentBible === "object" &&
        !Array.isArray(currentBible)
      ) {
        const bibleRecord = currentBible as Record<string, unknown>
        const filledFields = Object.entries(bibleRecord)
          .filter(([, v]) => v && String(v).trim())
          .map(([k, v]) => `${k}: ${String(v).slice(0, 500)}`)
          .join("\n")
        if (filledFields) {
          userPrompt += `\n\n当前已填写的信息：\n${filledFields}`
        }
      }
      break
    }

    case "braindump-expand": {
      const braindumpContent =
        currentBible &&
        typeof currentBible === "object" &&
        !Array.isArray(currentBible) &&
        "braindump" in (currentBible as Record<string, unknown>)
          ? String(
              (currentBible as Record<string, unknown>).braindump
            )
          : ""
      systemPrompt = `你是一个专业的小说创作助手。作者在灵感池中写下了自由文本，你需要将这些灵感整理并拆解到各个结构化字段中。\n\n${fullContext}\n\n以 JSON 格式返回，每个字段为建议内容。只包含能从灵感池中合理提取或推断的字段。格式示例：\n{"genre":"都市悬疑","synopsis":"故事讲述了...","themes":"正义与腐败","setting":"现代上海","tone":"紧张压抑","worldbuilding":"..."}\n\n注意：只输出 JSON，不要加任何其他文字。`
      userPrompt = `灵感池内容：\n${braindumpContent}`
      break
    }

    case "document-extract": {
      const rawTexts = Array.isArray(documentTexts) ? documentTexts : []
      const texts = rawTexts
        .slice(0, 5)
        .map((t: unknown) => String(t).slice(0, 3000))
        .join("\n---\n")
      systemPrompt = `你是一个专业的小说创作助手。分析作者的已写文本，从中提取故事圣经信息（角色、场景、世界观等）。\n\n以 JSON 格式返回提取结果，格式示例：\n{"characters":[{"name":"角色名","role":"主角","description":"描述","personality":"性格"}],"setting":"场景描述","themes":"主题","worldbuilding":"世界设定"}\n\n注意：只输出 JSON，不要加任何其他文字。只提取文本中明确出现的信息。`
      userPrompt = `请分析以下文本并提取故事信息：\n${texts}`
      break
    }

    case "character-generate": {
      const synopsisFromBible =
        currentBible &&
        typeof currentBible === "object" &&
        !Array.isArray(currentBible) &&
        "synopsis" in (currentBible as Record<string, unknown>)
          ? String(
              (currentBible as Record<string, unknown>).synopsis
            )
          : ""
      const synopsisText =
        synopsisFromBible || storyCtx.bible?.synopsis || ""
      systemPrompt = `你是一个专业的小说创作助手。根据故事梗概和已有信息生成角色列表。\n\n${fullContext}\n\n以 JSON 数组格式返回，格式示例：\n[{"name":"角色名","role":"主角","description":"角色描述","personality":"性格特征","goals":"目标"}]\n\n生成 3-6 个核心角色。注意：只输出 JSON 数组，不要加任何其他文字。`
      userPrompt = synopsisText.trim()
        ? `故事梗概：\n${synopsisText}`
        : "请根据已有的故事信息生成角色建议"
      break
    }
  }

  return [
    { role: "system", content: systemPrompt! },
    { role: "user", content: userPrompt! },
  ]
}

// ---------------------------------------------------------------------------
// Intent-specific pre-validation
// ---------------------------------------------------------------------------

function validateChatIntent(
  intent: ChatRouteIntent,
  body: Record<string, unknown>,
): Response | null {
  switch (intent) {
    case "chat": {
      if (!isChatMessageArray(body.messages) || (body.messages as unknown[]).length === 0) {
        return Response.json(
          { error: "缺少有效对话消息，请重新发送后重试" },
          { status: 400 },
        )
      }
      return null
    }
    case "brainstorm": {
      const topicValue = typeof body.topic === "string" ? body.topic.trim() : ""
      if (!topicValue) {
        return Response.json(
          { error: "缺少头脑风暴主题，请输入主题后重试" },
          { status: 400 },
        )
      }
      return null
    }
    case "twist": {
      const contextValue = typeof body.context === "string" ? body.context.trim() : ""
      if (!contextValue) {
        return Response.json(
          { error: "缺少上下文文本，请提供当前段落后重试" },
          { status: 400 },
        )
      }
      return null
    }
    case "muse": {
      const mode = body.mode
      if (
        typeof mode !== "string" ||
        !["what-if", "random-prompt", "suggest"].includes(mode)
      ) {
        return Response.json(
          { error: "无效的灵感模式" },
          { status: 400 },
        )
      }
      return null
    }
    case "bible-assist": {
      const modeValue = typeof body.mode === "string" ? body.mode : ""
      if (!modeValue || !VALID_BIBLE_MODES.includes(modeValue as BibleAssistMode)) {
        return Response.json(
          { error: "缺少必要参数或模式无效 (mode)" },
          { status: 400 },
        )
      }
      if (modeValue === "field-generate") {
        const targetFieldValue =
          typeof body.targetField === "string" ? body.targetField.trim() : ""
        if (!targetFieldValue) {
          return Response.json(
            { error: "field-generate 需要 targetField" },
            { status: 400 },
          )
        }
      }
      if (modeValue === "braindump-expand") {
        const braindumpContent =
          body.currentBible &&
          typeof body.currentBible === "object" &&
          !Array.isArray(body.currentBible) &&
          "braindump" in (body.currentBible as Record<string, unknown>)
            ? String((body.currentBible as Record<string, unknown>).braindump)
            : ""
        if (!braindumpContent.trim()) {
          return Response.json(
            { error: "灵感池内容为空" },
            { status: 400 },
          )
        }
      }
      if (modeValue === "document-extract") {
        const rawTexts = Array.isArray(body.documentTexts) ? body.documentTexts : []
        const texts = rawTexts
          .slice(0, 5)
          .map((t: unknown) => String(t).slice(0, 3000))
          .join("\n---\n")
        if (!texts.trim()) {
          return Response.json(
            { error: "没有可分析的文档内容" },
            { status: 400 },
          )
        }
      }
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Pre-parse body to extract intent before handing off to pipeline.
  // We clone so the pipeline can re-parse the body independently.
  let intent: ChatRouteIntent = "chat"
  let peekedBody: Record<string, unknown> = {}
  try {
    peekedBody = await request.clone().json()
    if (isChatRouteIntent(peekedBody.intent)) {
      intent = peekedBody.intent
    }
  } catch {
    // Body parse will fail again inside the pipeline, which returns 400.
  }

  // Pre-validate intent-specific fields against the peeked body.
  // This runs before the pipeline to return precise error messages.
  // The pipeline still handles auth, projectId, and AI config validation.
  if (Object.keys(peekedBody).length > 0) {
    const validationError = validateChatIntent(intent, peekedBody)
    if (validationError) {
      return validationError
    }
  }

  // Bible-assist needs access to storyCtx for character-generate synopsis fallback.
  // Handle it with a custom flow using validateAndResolve + direct streaming.
  if (intent === "bible-assist") {
    return handleBibleAssist(supabase, request)
  }

  return runStreamingPipeline({
    supabase,
    request,
    intent: intent as AIIntent,
    buildMessages({ body, fullContext }) {
      switch (intent) {
        case "brainstorm":
          return buildBrainstormMessages(body, fullContext)
        case "twist":
          return buildTwistMessages(body, fullContext)
        case "muse":
          return buildMuseMessages(body, fullContext)
        default:
          return buildChatMessages(body, fullContext)
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Bible-assist handler (needs storyCtx for character-generate)
// ---------------------------------------------------------------------------

async function handleBibleAssist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: NextRequest,
): Promise<Response> {
  const resolved = await validateAndResolve(supabase, request)
  if (resolved.error) {
    return resolved.error
  }

  const { userId, body, aiConfig } = resolved
  const projectId = (body.projectId as string).trim()
  const modeValue = body.mode as BibleAssistMode

  // Fetch story context (needed for character-generate synopsis fallback)
  let fullContext = ""
  let storyCtx: Awaited<ReturnType<typeof fetchStoryContext>>
  try {
    storyCtx = await fetchStoryContext(supabase, projectId, userId)
    const promptCtx = buildStoryPromptContext(storyCtx, {
      feature: "bible-assist",
    })
    fullContext = promptCtx.fullContext
  } catch {
    return Response.json(
      {
        error: "上下文加载失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 },
    )
  }

  const messages = buildBibleAssistMessages(body, fullContext, storyCtx)

  try {
    return await createOpenAIStreamResponse(
      {
        messages,
        maxTokens: 2000,
        temperature: 0.7,
        ...aiConfig,
      },
      {
        supabase,
        userId,
        projectId,
        documentId: null,
        feature: `bible-assist-${modeValue}`,
        promptLog: messages[1].content.slice(0, 500),
      },
    )
  } catch {
    return Response.json(
      {
        error: "AI 生成失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 },
    )
  }
}
