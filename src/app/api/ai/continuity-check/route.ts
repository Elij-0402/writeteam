import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"

interface ContinuityCheckRequestBody {
  [key: string]: unknown
  projectId?: unknown
  documentId?: unknown
  passage?: unknown
  context?: unknown
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  let body: ContinuityCheckRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求参数格式错误，请刷新后重试" }, { status: 400 })
  }

  const { projectId, documentId, passage, context } = body
  const projectIdValue = typeof projectId === "string" ? projectId.trim() : ""
  const documentIdValue = typeof documentId === "string" && documentId.trim().length > 0 ? documentId : null
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
      }
    )
  } catch {
    return Response.json(
      {
        error: "连续性检查失败，请重试或切换模型后继续",
        errorType: "server_error",
        retriable: true,
        suggestedActions: ["retry", "switch_model"],
      },
      { status: 500 }
    )
  }
}
