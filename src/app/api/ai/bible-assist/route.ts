import { type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

type BibleAssistMode =
  | "field-generate"
  | "braindump-expand"
  | "document-extract"
  | "character-generate"

const VALID_MODES: BibleAssistMode[] = [
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

interface BibleAssistRequestBody {
  [key: string]: unknown
  projectId?: unknown
  mode?: unknown
  targetField?: unknown
  currentBible?: unknown
  documentTexts?: unknown
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  let body: BibleAssistRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: "请求参数格式错误，请刷新后重试" },
      { status: 400 }
    )
  }

  const { projectId, mode, targetField, currentBible, documentTexts } = body
  const projectIdValue =
    typeof projectId === "string" ? projectId.trim() : ""
  const modeValue = typeof mode === "string" ? mode : ""

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json(
      { error: "AI 服务未配置，请先在设置中配置模型后重试" },
      { status: 400 }
    )
  }

  if (!projectIdValue) {
    return Response.json(
      { error: "缺少项目ID，请返回项目后重试" },
      { status: 400 }
    )
  }

  if (!modeValue || !VALID_MODES.includes(modeValue as BibleAssistMode)) {
    return Response.json(
      { error: "缺少必要参数或模式无效 (mode)" },
      { status: 400 }
    )
  }

  // Fetch existing story context for richer generation
  let fullContext = ""
  let storyCtx: Awaited<ReturnType<typeof fetchStoryContext>>
  try {
    storyCtx = await fetchStoryContext(supabase, projectIdValue, user.id)
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
      { status: 500 }
    )
  }

  let systemPrompt: string
  let userPrompt: string

  switch (modeValue as BibleAssistMode) {
    case "field-generate": {
      const targetFieldValue =
        typeof targetField === "string" ? targetField.trim() : ""
      if (!targetFieldValue) {
        return Response.json(
          { error: "field-generate 需要 targetField" },
          { status: 400 }
        )
      }
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
      if (!braindumpContent.trim()) {
        return Response.json(
          { error: "灵感池内容为空" },
          { status: 400 }
        )
      }
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
      if (!texts.trim()) {
        return Response.json(
          { error: "没有可分析的文档内容" },
          { status: 400 }
        )
      }
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

  try {
    return await createOpenAIStreamResponse(
      {
        messages: [
          { role: "system" as const, content: systemPrompt! },
          { role: "user" as const, content: userPrompt! },
        ],
        maxTokens: 2000,
        temperature: 0.7,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId: projectIdValue,
        documentId: null,
        feature: `bible-assist-${modeValue}`,
        promptLog: userPrompt!.slice(0, 500),
      }
    )
  } catch {
    return Response.json(
      {
        error: "AI 生成失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 }
    )
  }
}
