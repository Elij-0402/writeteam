import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

type ErrorCode = "UNAUTHORIZED" | "INVALID_QUERY" | "INTERNAL_ERROR"

interface FailureAnalysisRow {
  project_id: string
  document_id: string | null
  provider: string | null
  model: string | null
  attempted_model: string | null
  error_type: string | null
  recovery_status: string | null
  created_at: string
}

interface FailureCombo {
  provider: string
  model: string
  errorType: string
  count: number
  nextActions: string[]
}

type TimeRange = "24h" | "7d" | "30d"
type RecoveryStatus = "all" | "success" | "failure" | "recovered_retry" | "recovered_switch" | "unrecovered"

const PAGE_SIZE = 1000
const MAX_SCANNED_ROWS = 20000

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

function parseTimeRange(raw: string | null): TimeRange {
  if (raw === "24h" || raw === "7d" || raw === "30d") {
    return raw
  }

  return "7d"
}

function parseRecoveryStatus(raw: string | null): RecoveryStatus {
  if (
    raw === "all" ||
    raw === "success" ||
    raw === "failure" ||
    raw === "recovered_retry" ||
    raw === "recovered_switch" ||
    raw === "unrecovered"
  ) {
    return raw
  }

  return "all"
}

function buildRangeStart(range: TimeRange): string {
  const now = Date.now()
  const byMs: Record<TimeRange, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  }

  return new Date(now - byMs[range]).toISOString()
}

function getModelValue(row: FailureAnalysisRow): string {
  return (row.model || row.attempted_model || "unknown").trim() || "unknown"
}

function getProviderValue(row: FailureAnalysisRow, normalizedModel: string): string {
  const normalizedProvider = (row.provider || "").trim()
  if (normalizedProvider) {
    return normalizedProvider
  }
  return inferProvider(normalizedModel)
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

function getNextActions(errorType: string): string[] {
  switch (errorType) {
    case "auth":
      return ["检查 API Key 是否有效", "确认密钥权限与项目绑定", "验证 Base URL 是否匹配服务商"]
    case "model_not_found":
      return ["切换到可用模型", "核对模型 ID 拼写", "刷新模型列表后重试"]
    case "rate_limit":
      return ["启用指数退避重试", "降低并发请求", "切换备用模型分流"]
    case "timeout":
      return ["延长超时阈值", "缩短输入上下文长度", "切换延迟更低模型"]
    case "provider_unavailable":
      return ["检查 Provider 服务状态", "临时切换到备用 Provider", "确认网络出口与 DNS 可达"]
    case "server_error":
      return ["稍后重试", "切换模型规避瞬时故障", "记录失败窗口并观察趋势"]
    case "network":
      return ["检查本地与服务器网络", "增加重试与退避", "验证代理/防火墙配置"]
    case "format_incompatible":
      return ["检查请求参数兼容性", "切换支持当前参数的模型", "精简不受支持的字段"]
    default:
      return ["优先重试一次", "检查配置与模型匹配", "必要时切换模型验证"]
  }
}

function toFailureComboKey(provider: string, model: string, errorType: string): string {
  return `${provider}||${model}||${errorType}`
}

function isFailureByRecovery(row: FailureAnalysisRow): boolean {
  return row.recovery_status === "failure"
}

function isFailureByErrorType(row: FailureAnalysisRow): boolean {
  return typeof row.error_type === "string" && row.error_type.trim().length > 0
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "未登录")
  }

  const searchParams = new URL(request.url).searchParams
  const range = parseTimeRange(searchParams.get("range"))
  const providerFilter = (searchParams.get("provider") || "all").trim()
  const modelFilter = (searchParams.get("model") || "all").trim()
  const errorTypeFilter = (searchParams.get("errorType") || "all").trim()
  const recoveryStatusFilter = parseRecoveryStatus(searchParams.get("recoveryStatus"))

  if (!providerFilter || !modelFilter || !errorTypeFilter) {
    return errorResponse(400, "INVALID_QUERY", "筛选参数无效")
  }

  const fromDate = buildRangeStart(range)

  const rows: FailureAnalysisRow[] = []
  let offset = 0
  let truncated = false

  while (rows.length < MAX_SCANNED_ROWS) {
    let query = supabase
      .from("ai_history")
      .select("project_id,document_id,provider,model,attempted_model,error_type,recovery_status,created_at")
      .eq("user_id", user.id)
      .gte("created_at", fromDate)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (errorTypeFilter !== "all") {
      query = query.eq("error_type", errorTypeFilter)
    }

    if (recoveryStatusFilter !== "all") {
      query = query.eq("recovery_status", recoveryStatusFilter)
    }

    const { data, error } = await query

    if (error) {
      return errorResponse(500, "INTERNAL_ERROR", "失败分析数据读取失败，请稍后重试")
    }

    const pageRows = ((data ?? []) as FailureAnalysisRow[])
    if (pageRows.length === 0) {
      break
    }

    const availableCapacity = MAX_SCANNED_ROWS - rows.length
    rows.push(...pageRows.slice(0, availableCapacity))

    if (pageRows.length < PAGE_SIZE) {
      break
    }

    if (rows.length >= MAX_SCANNED_ROWS) {
      truncated = true
      break
    }

    offset += PAGE_SIZE
  }

  const hydrated = rows.map((row) => {
    const model = getModelValue(row)
    const provider = getProviderValue(row, model)
    return {
      ...row,
      model,
      provider,
      errorType: row.error_type || "unknown",
      failedByRecovery: isFailureByRecovery(row),
      failedByErrorType: isFailureByErrorType(row),
    }
  })

  const filtered = hydrated.filter((row) => {
    if (providerFilter !== "all" && row.provider !== providerFilter) {
      return false
    }
    if (modelFilter !== "all" && row.model !== modelFilter) {
      return false
    }
    return true
  })

  const failureRows = filtered.filter((row) => row.failedByRecovery || row.failedByErrorType)

  const providerCount = new Map<string, number>()
  const modelCount = new Map<string, number>()
  const errorTypeCount = new Map<string, number>()
  const comboCount = new Map<string, FailureCombo>()
  const projectSet = new Set<string>()
  const documentSet = new Set<string>()

  for (const row of failureRows) {
    providerCount.set(row.provider, (providerCount.get(row.provider) || 0) + 1)
    modelCount.set(row.model, (modelCount.get(row.model) || 0) + 1)
    errorTypeCount.set(row.errorType, (errorTypeCount.get(row.errorType) || 0) + 1)
    projectSet.add(row.project_id)
    if (row.document_id) {
      documentSet.add(row.document_id)
    }

    const key = toFailureComboKey(row.provider, row.model, row.errorType)
    const existing = comboCount.get(key)
    if (existing) {
      existing.count += 1
    } else {
      comboCount.set(key, {
        provider: row.provider,
        model: row.model,
        errorType: row.errorType,
        count: 1,
        nextActions: getNextActions(row.errorType),
      })
    }
  }

  const totalCalls = filtered.length
  const unionFailureCount = failureRows.length
  const recoveryFailureCount = filtered.filter((row) => row.failedByRecovery).length
  const errorTypeFailureCount = filtered.filter((row) => row.failedByErrorType).length
  const recoveryFailureRate = totalCalls > 0 ? Number(((recoveryFailureCount / totalCalls) * 100).toFixed(2)) : 0
  const errorTypeFailureRate = totalCalls > 0 ? Number(((errorTypeFailureCount / totalCalls) * 100).toFixed(2)) : 0

  const byProvider = Array.from(providerCount.entries())
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count)

  const byModel = Array.from(modelCount.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count)

  const byErrorType = Array.from(errorTypeCount.entries())
    .map(([errorType, count]) => ({ errorType, count }))
    .sort((a, b) => b.count - a.count)

  const topFailureCombos = Array.from(comboCount.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const recommendationPool = new Map<string, string[]>()
  for (const combo of topFailureCombos) {
    recommendationPool.set(combo.errorType, combo.nextActions)
  }

  const recommendations = Array.from(recommendationPool.entries()).map(([errorType, actions]) => ({
    errorType,
    title: `针对 ${errorType} 的优化建议`,
    actions,
  }))

  return Response.json({
    success: true,
    data: {
      range,
      summary: {
        totalCalls,
        totalFailures: recoveryFailureCount,
        failureRate: recoveryFailureRate,
        affectedProjects: projectSet.size,
        affectedDocuments: documentSet.size,
        failureByDefinition: {
          recoveryStatusFailure: recoveryFailureCount,
          errorTypeNonNull: errorTypeFailureCount,
          unionFailure: unionFailureCount,
          recoveryStatusFailureRate: recoveryFailureRate,
          errorTypeNonNullRate: errorTypeFailureRate,
        },
      },
      distributions: {
        byProvider,
        byModel,
        byErrorType,
      },
      topFailureCombos,
      recommendations,
      filters: {
        providers: Array.from(new Set(hydrated.map((row) => row.provider))).sort(),
        models: Array.from(new Set(hydrated.map((row) => row.model))).sort(),
        errorTypes: Array.from(new Set(hydrated.map((row) => row.errorType))).sort(),
        recoveryStatuses: Array.from(new Set(hydrated.map((row) => row.recovery_status).filter((value): value is string => Boolean(value)))).sort(),
      },
      notes: {
        providerRule:
          "provider 优先使用 ai_history.provider（基于 baseUrl 归一映射写入）；历史缺失数据回退为模型标识推断",
        failureRule:
          "主口径为 recovery_status = failure；同时并行输出 error_type != null 与 union 指标用于对比",
        truncated: truncated ? "结果已截断：仅统计最近 20000 条样本，请缩小时间范围或增加筛选条件" : "未截断",
      },
      meta: {
        scannedRows: rows.length,
        maxScannedRows: MAX_SCANNED_ROWS,
        truncated,
      },
    },
  })
}
