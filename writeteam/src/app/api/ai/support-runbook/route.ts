import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

type ErrorCode = "UNAUTHORIZED" | "INVALID_INPUT" | "INTERNAL_ERROR"
type ErrorType =
  | "auth"
  | "model_not_found"
  | "rate_limit"
  | "timeout"
  | "provider_unavailable"
  | "network"
  | "format_incompatible"
  | "server_error"

type ActionKind = "config_check" | "switch_model" | "retry" | "preserve_context"

interface AiHistoryRow {
  project_id: string | null
  document_id: string | null
  provider: string | null
  model: string | null
  attempted_model: string | null
  error_type: string | null
  recovery_status: string | null
  created_at: string
}

interface RunbookAction {
  id: string
  kind: ActionKind
  title: string
  action: string
  expected: string
  onFailure: string
  fallback: string
}

interface RunbookTemplate {
  precheck: string[]
  diagnosis: string[]
  recovery_actions: RunbookAction[]
  verify: string[]
  escalation: string[]
}

const SUPPORTED_ERROR_TYPES: ErrorType[] = [
  "auth",
  "model_not_found",
  "rate_limit",
  "timeout",
  "provider_unavailable",
  "network",
  "format_incompatible",
  "server_error",
]

function errorResponse(status: number, code: ErrorCode, message: string) {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status }
  )
}

function parseErrorType(raw: string | null | undefined): ErrorType | null {
  if (!raw) {
    return null
  }

  const normalized = raw.trim().toLowerCase()
  return SUPPORTED_ERROR_TYPES.find((item) => item === normalized) ?? null
}

function parseErrorTypesFromText(ticketText: string): ErrorType[] {
  const value = ticketText.toLowerCase()
  const matches = new Set<ErrorType>()

  if (value.includes("认证") || value.includes("api key") || value.includes("unauthorized") || value.includes("401")) {
    matches.add("auth")
  }
  if (value.includes("模型不存在") || value.includes("model_not_found") || value.includes("404") || value.includes("找不到模型")) {
    matches.add("model_not_found")
  }
  if (value.includes("限流") || value.includes("频率") || value.includes("rate") || value.includes("429")) {
    matches.add("rate_limit")
  }
  if (value.includes("超时") || value.includes("timeout") || value.includes("timed out")) {
    matches.add("timeout")
  }
  if (
    value.includes("服务不可用") ||
    value.includes("供应商不可用") ||
    value.includes("provider unavailable") ||
    value.includes("502") ||
    value.includes("503")
  ) {
    matches.add("provider_unavailable")
  }
  if (value.includes("网络") || value.includes("dns") || value.includes("socket") || value.includes("network")) {
    matches.add("network")
  }
  if (value.includes("格式") || value.includes("参数") || value.includes("schema") || value.includes("format")) {
    matches.add("format_incompatible")
  }
  if (value.includes("500") || value.includes("server error") || value.includes("内部错误") || value.includes("服务端错误")) {
    matches.add("server_error")
  }

  return Array.from(matches)
}

function inferProvider(model: string): string {
  const value = model.toLowerCase()
  if (value.includes("deepseek")) return "DeepSeek"
  if (value.includes("gpt") || value.includes("o1") || value.includes("o3") || value.includes("o4")) return "OpenAI"
  if (value.includes("qwen") || value.includes("glm") || value.includes("yi")) return "硅基流动"
  if (value.includes("claude")) return "OpenRouter"
  if (value.includes("llama") || value.includes("mistral") || value.includes("gemma")) return "Ollama"
  return "未知 Provider"
}

function selectPrimaryErrorType(errorTypes: ErrorType[]): ErrorType {
  if (errorTypes.includes("auth")) return "auth"
  if (errorTypes.includes("model_not_found")) return "model_not_found"
  if (errorTypes.includes("rate_limit")) return "rate_limit"
  if (errorTypes.includes("timeout")) return "timeout"
  if (errorTypes.includes("provider_unavailable")) return "provider_unavailable"
  if (errorTypes.includes("network")) return "network"
  if (errorTypes.includes("format_incompatible")) return "format_incompatible"
  return "server_error"
}

function buildErrorSpecificAction(primaryErrorType: ErrorType): RunbookAction {
  switch (primaryErrorType) {
    case "auth":
      return {
        id: "specific-auth",
        kind: "config_check",
        title: "修复认证与权限",
        action: "核对 API Key 有效性、权限范围与 Base URL 匹配关系",
        expected: "连接测试返回成功，错误不再出现",
        onFailure: "切换备用 Provider 或重新签发密钥",
        fallback: "退回已验证可用的模型与配置",
      }
    case "model_not_found":
      return {
        id: "specific-model",
        kind: "switch_model",
        title: "切换到可用模型",
        action: "从模型列表选择可用模型并替换当前模型 ID",
        expected: "续写/改写请求可正常返回",
        onFailure: "切换 Provider 后再次尝试",
        fallback: "使用平台默认推荐模型",
      }
    case "rate_limit":
      return {
        id: "specific-rate-limit",
        kind: "retry",
        title: "执行退避重试",
        action: "降低并发并延迟重试，必要时切换轻量模型",
        expected: "重试后请求成功且延迟下降",
        onFailure: "切换 Provider 分流",
        fallback: "引导用户稍后再试并保留当前上下文",
      }
    case "timeout":
      return {
        id: "specific-timeout",
        kind: "retry",
        title: "缩短上下文并重试",
        action: "减少输入长度并重试请求，必要时切换低延迟模型",
        expected: "请求在超时阈值内完成",
        onFailure: "改用备用模型继续",
        fallback: "保留上下文并拆分任务分段生成",
      }
    case "provider_unavailable":
      return {
        id: "specific-provider",
        kind: "switch_model",
        title: "切换服务通道",
        action: "检查服务状态后切换到备用 Provider 与可用模型",
        expected: "请求在新通道正常返回",
        onFailure: "执行网络与 DNS 排查",
        fallback: "转人工支持并记录失败窗口",
      }
    case "network":
      return {
        id: "specific-network",
        kind: "config_check",
        title: "排查网络连通性",
        action: "检查本地网络、代理、防火墙与 DNS",
        expected: "连接测试可达且稳定",
        onFailure: "切换网络出口或 Provider",
        fallback: "离线保存上下文，待网络恢复后重试",
      }
    case "format_incompatible":
      return {
        id: "specific-format",
        kind: "config_check",
        title: "修复参数兼容性",
        action: "检查请求字段与模型兼容性，移除不支持参数",
        expected: "请求参数通过并返回结果",
        onFailure: "切换兼容模型",
        fallback: "使用基础参数模板重新发起请求",
      }
    case "server_error":
      return {
        id: "specific-server",
        kind: "retry",
        title: "规避瞬时服务端故障",
        action: "短暂等待后重试，若持续失败则切换模型",
        expected: "重试成功且错误消失",
        onFailure: "切换 Provider 并继续",
        fallback: "升级人工支持并附带失败样本",
      }
  }
}

function buildRunbookTemplate(primaryErrorType: ErrorType, errorTypes: ErrorType[], provider: string, model: string): RunbookTemplate {
  const actions: RunbookAction[] = [
    {
      id: "baseline-config",
      kind: "config_check",
      title: "检查配置",
      action: "检查 Base URL、API Key、模型 ID 与 Provider 是否匹配",
      expected: "连接测试通过，配置合法",
      onFailure: "修正配置后继续",
      fallback: "回退到最后一次可用配置",
    },
    {
      id: "baseline-switch",
      kind: "switch_model",
      title: "切换模型建议",
      action: "在当前 Provider 下切换备用模型，或切换到备用 Provider",
      expected: "新模型可稳定返回",
      onFailure: "继续执行重试策略",
      fallback: "记录失败并准备升级",
    },
    {
      id: "baseline-retry",
      kind: "retry",
      title: "执行重试",
      action: "按退避策略重试一次并记录耗时与结果",
      expected: "请求成功返回",
      onFailure: "进入上下文保留流程",
      fallback: "提示用户稍后再试",
    },
    {
      id: "baseline-context",
      kind: "preserve_context",
      title: "保留上下文继续",
      action: "保存当前编辑状态，使用最小必要上下文恢复创作",
      expected: "用户可不中断继续写作",
      onFailure: "创建支持工单并附加上下文标识",
      fallback: "指导用户手动导出并恢复文稿",
    },
    buildErrorSpecificAction(primaryErrorType),
  ]

  return {
    precheck: [
      "确认用户已登录且拥有当前项目访问权限",
      "确认未暴露任何 API Key 或敏感信息",
      `确认目标 Provider/Model：${provider} / ${model}`,
    ],
    diagnosis: [
      "读取最近失败记录，沿用 recovery_status=failure 的主口径",
      `识别错误类型优先级：${errorTypes.join("、")}`,
      "确认失败是否可通过重试或模型切换快速恢复",
    ],
    recovery_actions: actions,
    verify: [
      "执行连接测试并验证目标模型可用",
      "执行一次实际请求验证恢复动作有效",
      "确认用户可在不丢失上下文的情况下继续创作",
    ],
    escalation: [
      "连续 3 次执行恢复动作仍失败",
      "错误涉及账户权限或平台级故障",
      "无法在用户权限边界内完成恢复",
    ],
  }
}

function parseDateInput(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.toISOString()
}

function hasProvidedDate(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0
}

function parseContextRef(contextRef: string): { projectId?: string; documentId?: string; rawId?: string } {
  if (!contextRef) {
    return {}
  }

  const value = contextRef.trim()
  if (value.startsWith("project:")) {
    return { projectId: value.slice("project:".length).trim() }
  }
  if (value.startsWith("document:")) {
    return { documentId: value.slice("document:".length).trim() }
  }
  return { rawId: value }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "未登录")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, "INVALID_INPUT", "请求体不是有效 JSON")
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
  const ticketText = typeof payload?.ticketText === "string" ? payload.ticketText.trim() : ""
  const targetProvider = typeof payload?.targetProvider === "string" ? payload.targetProvider.trim() : ""
  const targetModel = typeof payload?.targetModel === "string" ? payload.targetModel.trim() : ""
  const contextRef = typeof payload?.contextRef === "string" ? payload.contextRef.trim() : ""
  const from = parseDateInput(payload?.from)
  const to = parseDateInput(payload?.to)
  const recentLimitRaw = typeof payload?.recentLimit === "number" ? payload.recentLimit : 20
  const recentLimit = Math.max(5, Math.min(50, Math.floor(recentLimitRaw)))

  if (!ticketText && !targetProvider && !targetModel && !contextRef) {
    return errorResponse(400, "INVALID_INPUT", "缺少必要上下文：请提供工单文本或目标 provider/model")
  }

  if (hasProvidedDate(payload?.from) && !from) {
    return errorResponse(400, "INVALID_INPUT", "from 不是有效时间")
  }

  if (hasProvidedDate(payload?.to) && !to) {
    return errorResponse(400, "INVALID_INPUT", "to 不是有效时间")
  }

  const errorTypesFromText = parseErrorTypesFromText(ticketText)

  let query = supabase
    .from("ai_history")
    .select("project_id,document_id,provider,model,attempted_model,error_type,recovery_status,created_at")
    .eq("user_id", user.id)
    .eq("recovery_status", "failure")
    .order("created_at", { ascending: false })
    .limit(recentLimit)

  if (targetProvider) {
    query = query.eq("provider", targetProvider)
  }

  if (targetModel) {
    query = query.eq("model", targetModel)
  }

  if (from) {
    query = query.gte("created_at", from)
  }

  if (to) {
    query = query.lte("created_at", to)
  }

  const { data, error } = await query

  if (error) {
    return errorResponse(500, "INTERNAL_ERROR", "Runbook 数据读取失败，请稍后重试")
  }

  const rows = ((data ?? []) as AiHistoryRow[]).map((row) => {
    const model = (row.model || row.attempted_model || targetModel || "unknown").trim() || "unknown"
    const provider = (row.provider || targetProvider || inferProvider(model)).trim() || "未知 Provider"
    return {
      ...row,
      model,
      provider,
      normalizedErrorType: parseErrorType(row.error_type),
    }
  })

  const parsedContext = parseContextRef(contextRef)
  const scopedRows = contextRef
    ? rows.filter((row) => {
        if (parsedContext.projectId) {
          return row.project_id === parsedContext.projectId
        }
        if (parsedContext.documentId) {
          return row.document_id === parsedContext.documentId
        }
        if (parsedContext.rawId) {
          return row.project_id === parsedContext.rawId || row.document_id === parsedContext.rawId
        }
        return false
      })
    : rows
  const sourceRows = scopedRows.length > 0 ? scopedRows : rows

  const counts = new Map<ErrorType, number>()
  for (const errorType of errorTypesFromText) {
    counts.set(errorType, (counts.get(errorType) ?? 0) + 1)
  }

  for (const row of sourceRows) {
    if (!row.normalizedErrorType) {
      continue
    }
    counts.set(row.normalizedErrorType, (counts.get(row.normalizedErrorType) ?? 0) + 1)
  }

  const sortedErrorTypes: ErrorType[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)

  const errorTypes: ErrorType[] = sortedErrorTypes.length > 0 ? sortedErrorTypes : ["server_error"]
  const primaryErrorType = selectPrimaryErrorType(errorTypes)

  const firstRow = sourceRows[0] ?? rows[0]
  const provider = firstRow?.provider || targetProvider || "未知 Provider"
  const model = firstRow?.model || targetModel || "unknown"

  const template = buildRunbookTemplate(primaryErrorType, errorTypes, provider, model)

  return Response.json({
    success: true,
    data: {
      primaryErrorType,
      errorTypes,
      input: {
        ticketText,
        targetProvider,
        targetModel,
        contextRef,
      },
      template,
    },
  })
}
