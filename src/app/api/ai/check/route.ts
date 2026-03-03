import { NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { callOpenAIJson } from "@/lib/ai/openai-json"
import { computeSaliency } from "@/lib/ai/saliency"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"

// ---------------------------------------------------------------------------
// Check intent types
// ---------------------------------------------------------------------------

type CheckRouteIntent = "continuity-check" | "saliency" | "feedback"

function isCheckRouteIntent(value: unknown): value is CheckRouteIntent {
  return (
    value === "continuity-check" ||
    value === "saliency" ||
    value === "feedback"
  )
}

// ---------------------------------------------------------------------------
// Feedback error helpers
// ---------------------------------------------------------------------------

type FeedbackErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "NOT_FOUND"
  | "ALREADY_RATED"
  | "INTERNAL_ERROR"

function feedbackErrorResponse(status: number, code: FeedbackErrorCode, message: string) {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status },
  )
}

function parseRating(value: unknown): 1 | -1 | null {
  return value === 1 || value === -1 ? value : null
}

// ---------------------------------------------------------------------------
// handleContinuityCheck — streaming, uses shared AI pipeline
// ---------------------------------------------------------------------------

async function handleContinuityCheck(
  supabase: SupabaseClient,
  request: NextRequest,
  body: Record<string, unknown>,
): Promise<Response> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  const { projectId, documentId, passage, context } = body
  const projectIdValue = typeof projectId === "string" ? projectId.trim() : ""
  const documentIdValue =
    typeof documentId === "string" && documentId.trim().length > 0 ? documentId : null
  const passageValue = typeof passage === "string" ? passage.trim() : ""
  const contextValue = typeof context === "string" ? context : ""

  const logPrecheckFailure = async (errorType: string, errorMessage: string) => {
    if (!projectIdValue) {
      return
    }

    await supabase.from("ai_history").insert({
      user_id: user.id,
      project_id: projectIdValue,
      document_id: documentIdValue,
      feature: "continuity-check",
      prompt: `Continuity precheck: ${passageValue.slice(0, 200)}`,
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

  if (!projectIdValue) {
    return Response.json({ error: "缺少项目ID，请返回项目后重试" }, { status: 400 })
  }

  if (!passageValue) {
    await logPrecheckFailure("validation", "缺少待检查段落，请输入或选择文本后重试")
    return Response.json({ error: "缺少待检查段落，请输入或选择文本后重试" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectIdValue, user.id)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "continuity-check" })

  let systemPrompt =
    "你是严格的小说连续性审校助手。请仅输出 JSON，不要输出任何额外解释。JSON 结构必须为：{\"summary\":string,\"issues\":Issue[]}。Issue 结构必须包含 issue/type/reason/evidence/evidenceSource/evidenceQuote/evidenceAnchor/fix/action/actionType/insertionText/replacementText。evidenceSource 仅允许：正文片段、故事圣经、角色资料、系列设定。action 结构必须包含 action.type/action.target/action.text。action.type 仅允许 insert 或 replace；action.target 仅允许 current_passage 或 selected_text。请保证 action 与旧字段一致：当 action.type=insert 时，action.target 必须为 current_passage，insertionText 必须等于 action.text，replacementText 必须为空字符串；当 action.type=replace 时，action.target 必须为 selected_text，replacementText 必须等于 action.text，insertionText 必须为空字符串。"
  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `${contextValue ? `最近章节上下文（仅供参考）:\n${contextValue.slice(-2500)}\n\n` : ""}请检查以下文本的连续性冲突（时间线、设定一致性、角色行为逻辑、视角一致性等）：\n\n${passageValue}\n\n输出要求：\n1) 必须输出 JSON 对象，不要 Markdown 包裹，不要额外文本。\n2) 若无问题，输出：{\"summary\":\"未发现明显连续性问题\",\"issues\":[]}\n3) 若有问题，issues 中每一项必须包含：\n- issue: 问题描述\n- type: 问题类型\n- reason: 冲突原因\n- evidence: 证据定位（保留给旧客户端）\n- evidenceSource: 正文片段|故事圣经|角色资料|系列设定\n- evidenceQuote: 证据原文摘录（稳定字段）\n- evidenceAnchor: 证据锚点（如章节/角色/设定条目）\n- fix: 修正建议\n- action: { type: insert|replace, target: current_passage|selected_text, text: 建议文本 }\n- actionType: insert|replace（与 action.type 保持一致）\n- insertionText: 仅当 action.type=insert 时填写 action.text，否则写空字符串\n- replacementText: 仅当 action.type=replace 时填写 action.text，否则写空字符串`

  try {
    return await createOpenAIStreamResponse(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1200,
        temperature: 0.3,
        ...aiConfig,
      },
      {
        supabase,
        userId: user.id,
        projectId: projectIdValue,
        documentId: documentIdValue,
        feature: "continuity-check",
        promptLog: passageValue.slice(0, 500),
        ...extractRetryMeta(body),
      },
    )
  } catch {
    return Response.json(
      {
        error: "连续性检查失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// handleSaliency — non-streaming, hybrid heuristic + AI JSON
// ---------------------------------------------------------------------------

async function handleSaliency(
  supabase: SupabaseClient,
  request: NextRequest,
  body: Record<string, unknown>,
): Promise<Response> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  const text = typeof body.text === "string" ? body.text : ""
  const projectId = typeof body.projectId === "string" ? body.projectId : ""

  if (!text || !projectId) {
    return Response.json({ error: "缺少必要参数" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId, user.id)

  // First compute heuristic saliency as a fast baseline
  const heuristicResult = computeSaliency(
    text,
    storyCtx.characters.map((c) => ({ name: c.name, role: c.role })),
    storyCtx.bible?.setting,
    storyCtx.bible?.worldbuilding,
  )

  // Attempt AI-enhanced saliency analysis for richer results
  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    // Fall back to heuristic result when no AI config
    return Response.json(heuristicResult)
  }

  const characterNames = storyCtx.characters.map((c) => c.name).join("、")
  const settingInfo = storyCtx.bible?.setting || ""

  const systemPrompt = `你是一位专业的小说场景分析助手。你的任务是分析给定的文本片段，识别当前场景中活跃的元素。

请严格以 JSON 格式返回结果，不要包含任何其他文字。

返回格式：
{
  "activeCharacters": ["角色名1", "角色名2"],
  "activeLocations": ["地点1"],
  "activePlotlines": ["情节线1"]
}

规则：
- activeCharacters: 仅返回在文本中明确出场或被直接提及的角色名称
- activeLocations: 返回当前场景发生的地点
- activePlotlines: 返回当前正在推进的情节线（简要描述，最多 3 条）
- 所有数组如果没有匹配项则返回空数组`

  const userPrompt = `已知角色列表：${characterNames || "暂无"}
已知故事设定：${settingInfo || "暂无"}

请分析以下文本片段中的活跃元素：

${text.slice(-2000)}`

  const startedAt = Date.now()

  try {
    const result = await callOpenAIJson({
      ...aiConfig,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 500,
      temperature: 0.3,
    })

    if (result.error) {
      // Fall back to heuristic on API error
      return Response.json(heuristicResult)
    }

    const content = result.content

    // Log telemetry
    await supabase.from("ai_history").insert({
      user_id: user.id,
      project_id: projectId,
      document_id: null,
      feature: "saliency",
      prompt: userPrompt.slice(0, 500),
      result: content,
      model: aiConfig.modelId,
      tokens_used: estimateTokenCount(content),
      latency_ms: Date.now() - startedAt,
      output_chars: content.length,
      response_fingerprint: createTextFingerprint(content),
    })

    // Parse AI response
    try {
      // Strip markdown code fences if present
      const cleaned = content
        .replace(/```(?:json)?\s*/g, "")
        .replace(/```\s*/g, "")
        .trim()
      const parsed = JSON.parse(cleaned)

      const saliencyResult = {
        activeCharacters: Array.isArray(parsed.activeCharacters)
          ? parsed.activeCharacters.slice(0, 5)
          : heuristicResult.activeCharacters,
        activeLocations: Array.isArray(parsed.activeLocations)
          ? parsed.activeLocations.slice(0, 3)
          : heuristicResult.activeLocations,
        activePlotlines: Array.isArray(parsed.activePlotlines)
          ? parsed.activePlotlines.slice(0, 3)
          : heuristicResult.activePlotlines,
      }

      return Response.json(saliencyResult)
    } catch {
      // JSON parse failed, fall back to heuristic
      return Response.json(heuristicResult)
    }
  } catch {
    // Network error, fall back to heuristic
    return Response.json(heuristicResult)
  }
}

// ---------------------------------------------------------------------------
// handleFeedback — non-streaming, pure DB operation (no AI call)
// ---------------------------------------------------------------------------

async function handleFeedback(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return feedbackErrorResponse(401, "UNAUTHORIZED", "未登录")
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
  const feature = typeof body.feature === "string" ? body.feature.trim() : ""
  const responseFingerprint =
    typeof body.responseFingerprint === "string" ? body.responseFingerprint.trim() : ""
  const rating = parseRating(body.rating)

  if (!projectId || !feature || !responseFingerprint || rating === null) {
    return feedbackErrorResponse(400, "INVALID_PAYLOAD", "反馈参数无效，仅支持 -1 或 1")
  }

  const { data: matchedRows, error: lookupError } = await supabase
    .from("ai_history")
    .select("id,user_rating")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .eq("feature", feature)
    .eq("response_fingerprint", responseFingerprint)
    .order("created_at", { ascending: false })
    .limit(1)

  if (lookupError) {
    return feedbackErrorResponse(500, "INTERNAL_ERROR", "反馈状态查询失败，请稍后重试")
  }

  if (!matchedRows || matchedRows.length === 0) {
    return feedbackErrorResponse(404, "NOT_FOUND", "未找到对应的 AI 响应")
  }

  const matched = matchedRows[0]
  if (!matched) {
    return feedbackErrorResponse(404, "NOT_FOUND", "未找到对应的 AI 响应")
  }

  if (matched.user_rating === 1 || matched.user_rating === -1) {
    return Response.json(
      {
        success: false,
        error: {
          code: "ALREADY_RATED",
          message: "该 AI 响应已反馈过，不能重复提交",
        },
        existingRating: matched.user_rating,
      },
      { status: 409 },
    )
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("ai_history")
    .update({
      user_rating: rating,
      rated_at: new Date().toISOString(),
    })
    .eq("id", matched.id)
    .eq("user_id", user.id)
    .is("user_rating", null)
    .select("id")

  if (updateError) {
    return feedbackErrorResponse(500, "INTERNAL_ERROR", "反馈写入失败，请稍后重试")
  }

  if (!updatedRows || updatedRows.length === 0) {
    return feedbackErrorResponse(409, "ALREADY_RATED", "该 AI 响应已反馈过，不能重复提交")
  }

  return Response.json({ success: true })
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const clonedRequest = request.clone()

  let body: Record<string, unknown>
  try {
    body = await clonedRequest.json()
  } catch {
    return Response.json({ error: "请求参数格式错误，请刷新后重试" }, { status: 400 })
  }

  const intent: CheckRouteIntent = isCheckRouteIntent(body.intent) ? body.intent : "continuity-check"

  switch (intent) {
    case "saliency":
      return handleSaliency(supabase, request, body)
    case "feedback":
      return handleFeedback(supabase, body)
    case "continuity-check":
    default:
      return handleContinuityCheck(supabase, request, body)
  }
}
