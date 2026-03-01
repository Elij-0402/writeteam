import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import type { SaliencyMap } from "@/lib/ai/story-context"

interface QuickEditRequestBody {
  [key: string]: unknown
  text?: unknown
  instruction?: unknown
  context?: unknown
  projectId?: unknown
  documentId?: unknown
  proseMode?: unknown
  saliency?: unknown
}

function isSaliencyMap(value: unknown): value is SaliencyMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.activeCharacters) &&
    Array.isArray(v.activeLocations) &&
    Array.isArray(v.activePlotlines) &&
    v.activeCharacters.every((item) => typeof item === "string") &&
    v.activeLocations.every((item) => typeof item === "string") &&
    v.activePlotlines.every((item) => typeof item === "string")
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  let body: QuickEditRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求参数格式错误，请刷新后重试" }, { status: 400 })
  }

  const { text, instruction, context, projectId, documentId, proseMode, saliency } = body
  const proseModeValue = typeof proseMode === "string" ? proseMode : null
  const saliencyMap = isSaliencyMap(saliency) ? saliency : null
  const documentIdValue =
    typeof documentId === "string" && documentId.trim().length > 0 ? documentId : null

  const telemetryProjectId =
    typeof projectId === "string" && projectId.trim().length > 0 ? projectId.trim() : null

  const logPrecheckFailure = async (errorType: string, errorMessage: string) => {
    if (!telemetryProjectId) {
      return
    }

    await supabase.from("ai_history").insert({
      user_id: user.id,
      project_id: telemetryProjectId,
      document_id: documentIdValue,
      feature: "quick-edit",
      prompt: `Quick Edit precheck: ${typeof instruction === "string" ? instruction.slice(0, 200) : ""}`,
      result: "",
      model: null,
      output_chars: 0,
      error_type: errorType,
      error_message: errorMessage,
      recovery_status: "failure",
    })
  }

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    await logPrecheckFailure("config_missing", "AI 服务未配置，请先在设置中配置模型后重试")
    return Response.json({ error: "AI 服务未配置，请先在设置中配置模型后重试" }, { status: 400 })
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    await logPrecheckFailure("validation", "缺少选中文本，请重新选择文本后重试")
    return Response.json({ error: "缺少选中文本，请重新选择文本后重试" }, { status: 400 })
  }

  if (typeof instruction !== "string" || instruction.trim().length === 0) {
    await logPrecheckFailure("validation", "缺少编辑指令，请输入编辑指令后重试")
    return Response.json({ error: "缺少编辑指令，请输入编辑指令后重试" }, { status: 400 })
  }

  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    return Response.json({ error: "缺少项目ID，请返回项目后重试" }, { status: 400 })
  }

  const contextText = typeof context === "string" ? context : ""

  const storyCtx = await fetchStoryContext(supabase, projectId, user.id)
  const { fullContext } = buildStoryPromptContext(storyCtx, {
    feature: "quick-edit",
    proseMode: proseModeValue,
    saliencyMap,
  })

  let systemPrompt = `You are a creative fiction writing AI assistant. Your task is to edit the selected text according to the author's natural language instruction. Return ONLY the edited text — no explanations, no quotes, no markdown.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Selected text to edit:\n"""${text}"""\n\nAuthor's instruction: "${instruction}"\n\nSurrounding context (for reference only — do NOT include it in your output):\n${contextText.slice(-2000)}\n\nReturn the edited version of the selected text only:`

  try {
    return await createOpenAIStreamResponse(
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
        documentId: documentIdValue,
        feature: "quick-edit",
        promptLog: `Quick Edit: "${instruction}" on "${text.slice(0, 200)}"`,
        ...extractRetryMeta(body),
      }
    )
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
