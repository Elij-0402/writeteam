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
  "what-if": `你是一位天马行空的小说灵感缪斯。你的角色是生成引人入胜的「假如……」场景，将故事引向意想不到的精彩方向。跳出常规思维——用大胆、富有想象力又不失故事世界逻辑的可能性来惊艳作者。提供3-5个「假如……」场景，每个写成简短而富有画面感的段落，用编号清晰标注。`,

  "random-prompt": `你是一位充满灵感的创意写作缪斯。生成5个生动、富有感染力的写作提示，能够激发新的场景、角色或情节发展。每个提示应该是一句引人入胜的话——注重感官细节、情感钩子和引人注目的情境。用编号清晰标注，让它们在基调和格局上多样化。`,

  "suggest": `你是一位敏锐的故事分析师和创意顾问。仔细分析当前文本，提出3-5个具体的故事推进方向建议。对于每个建议，简要解释为什么它在叙事上是可行的（张力、角色发展、主题共鸣等）。要具体——引用文本中的实际元素。用编号清晰标注。`,
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

  const systemPrompt = `你是一名博学、富有创造力的 AI 写作助手。你可以访问作者的故事信息和当前文档。帮助他们头脑风暴、解决情节难题、发展角色、回答关于故事的问题。回答要简洁但有洞察力，建议修改时要具体。
${fullContext ? `\n${fullContext}\n` : ""}
${contextValue ? `当前文档上下文（最后3000字）：\n${contextValue}\n` : ""}`

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

  let systemPrompt = `你是小说作家的创意头脑风暴伙伴。生成独特、有趣且多样化的创意。要有创造力和意外感。将每个创意格式化为编号列表，附带简短解释。`
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `请为以下主题进行头脑风暴，生成8-10个创意点子："${topicValue}"

${contextValue ? `故事上下文供参考：\n${contextValue.slice(-1000)}\n\n` : ""}请生成多样化的、有趣的选项。每个创意包含点子本身以及一句话解释为什么有趣或如何使用。`

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
        ? `基于以下故事上下文和作者的具体问题，生成「假如……」场景。\n\n作者的问题：${inputValue}\n\n近期故事文本：\n${contextValue || "（未提供文本）"}`
        : `基于故事上下文，生成出人意料的「假如……」场景，将故事引向新方向。\n\n近期故事文本：\n${contextValue || "（未提供文本）"}`
      break
    case "random-prompt":
      userPrompt = contextValue
        ? `请根据这个故事世界及其角色生成创意写作提示。\n\n近期故事文本：\n${contextValue}`
        : `请生成生动、富有感染力的小说创意写作提示。`
      break
    case "suggest":
      userPrompt = `请分析以下文本并提出具体的故事推进方向建议。\n\n当前文本：\n${contextValue || "（未提供文本）"}`
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
