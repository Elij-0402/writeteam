export type EvidenceSource = "正文片段" | "故事圣经" | "角色资料" | "系列设定" | "未知"

export interface ContinuityIssue {
  issue: string
  type: string
  reason: string
  evidence: string
  evidenceSource: EvidenceSource
  fix: string
  actionType: "insert" | "replace"
  insertionText: string
  replacementText: string
}

export interface ContinuityResult {
  summary: string
  issues: ContinuityIssue[]
  hasIssues: boolean
  raw: string
}

interface ContinuityResultPayload {
  summary?: unknown
  issues?: unknown
}

interface ContinuityIssuePayload {
  issue?: unknown
  type?: unknown
  reason?: unknown
  evidence?: unknown
  evidenceSource?: unknown
  fix?: unknown
  actionType?: unknown
  insertionText?: unknown
  replacementText?: unknown
}

function pickText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeSource(value: unknown): EvidenceSource {
  const source = pickText(value)
  if (source === "正文片段" || source === "故事圣经" || source === "角色资料" || source === "系列设定") {
    return source
  }
  if (source.includes("正文")) return "正文片段"
  if (source.includes("圣经")) return "故事圣经"
  if (source.includes("角色")) return "角色资料"
  if (source.includes("系列")) return "系列设定"
  return "未知"
}

function normalizeActionType(value: unknown): "insert" | "replace" {
  return value === "replace" ? "replace" : "insert"
}

function normalizeIssue(value: unknown): ContinuityIssue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const payload = value as ContinuityIssuePayload
  const issue = pickText(payload.issue)
  const reason = pickText(payload.reason)
  const fix = pickText(payload.fix)
  const evidence = pickText(payload.evidence)

  if (!issue || !reason || !fix || !evidence) {
    return null
  }

  return {
    issue,
    type: pickText(payload.type, "连续性问题"),
    reason,
    evidence,
    evidenceSource: normalizeSource(payload.evidenceSource),
    fix,
    actionType: normalizeActionType(payload.actionType),
    insertionText: pickText(payload.insertionText, fix),
    replacementText: pickText(payload.replacementText, fix),
  }
}

function extractJsonText(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const objectMatch = raw.match(/\{[\s\S]*\}/)
  if (objectMatch?.[0]) {
    return objectMatch[0].trim()
  }

  return null
}

function parseFromJson(raw: string): ContinuityResult | null {
  const jsonText = extractJsonText(raw)
  if (!jsonText) {
    return null
  }

  try {
    const parsed = JSON.parse(jsonText) as ContinuityResultPayload
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues
          .map((item) => normalizeIssue(item))
          .filter((item): item is ContinuityIssue => Boolean(item))
      : []

    return {
      summary: pickText(parsed.summary, issues.length > 0 ? `共发现 ${issues.length} 个连续性问题` : "未发现明显连续性问题"),
      issues,
      hasIssues: issues.length > 0,
      raw,
    }
  } catch {
    return null
  }
}

function parseFallback(raw: string): ContinuityResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      summary: "暂无结果",
      issues: [],
      hasIssues: false,
      raw,
    }
  }

  if (trimmed.includes("No continuity issues found") || trimmed.includes("未发现")) {
    return {
      summary: "未发现明显连续性问题",
      issues: [],
      hasIssues: false,
      raw,
    }
  }

  return {
    summary: "已生成连贯性分析（建议使用结构化结果）",
    issues: [],
    hasIssues: false,
    raw,
  }
}

export function parseContinuityResult(raw: string): ContinuityResult {
  const parsed = parseFromJson(raw)
  if (parsed) {
    return parsed
  }
  return parseFallback(raw)
}
