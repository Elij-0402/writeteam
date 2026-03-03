import type { ConsistencyState, ConstraintRule } from "@/lib/story-bible/consistency"

type ConsistencySeverity = "high" | "medium" | "low"

interface ConsistencyPreflightViolation {
  severity: ConsistencySeverity
  category: ConstraintRule["category"] | "timeline" | "character"
  message: string
  rule?: string
}

interface ConsistencyPreflightInput {
  text: string
  consistencyState?: ConsistencyState | null
}

interface ConsistencyPreflightResult {
  shouldBlock: boolean
  highestSeverity: ConsistencySeverity | null
  violations: ConsistencyPreflightViolation[]
  softFailed: boolean
}

const HARD_RULE_PREFIX = /^(禁止|不得|不能|不可|严禁|必须|务必|应当|需要)/

function extractRuleTarget(rule: string): string | null {
  const normalized = rule.replace(/[。.!?！？]$/g, "").trim()
  if (!normalized) {
    return null
  }

  if (!HARD_RULE_PREFIX.test(normalized)) {
    return normalized.length > 18 ? normalized.slice(0, 18) : normalized
  }

  const target = normalized.replace(HARD_RULE_PREFIX, "").trim()
  if (!target) {
    return null
  }

  const split = target.split(/[，,；;。.!！？\n]/)[0]?.trim()
  return split && split.length > 0 ? split : null
}

function normalizeRuleTarget(target: string): string {
  return target.replace(/^(使用|出现|进行|发生|保持|采用)/, "")
}

function matchesTarget(text: string, target: string): boolean {
  if (text.includes(target)) {
    return true
  }

  const normalizedTarget = normalizeRuleTarget(target)
  return normalizedTarget.length >= 2 ? text.includes(normalizedTarget) : false
}

function getHighestSeverity(
  violations: ConsistencyPreflightViolation[]
): ConsistencySeverity | null {
  if (violations.some((item) => item.severity === "high")) {
    return "high"
  }
  if (violations.some((item) => item.severity === "medium")) {
    return "medium"
  }
  if (violations.some((item) => item.severity === "low")) {
    return "low"
  }
  return null
}

export function runConsistencyPreflight(
  input: ConsistencyPreflightInput
): ConsistencyPreflightResult {
  try {
    const { text, consistencyState } = input
    if (!consistencyState || typeof text !== "string" || text.trim().length === 0) {
      return {
        shouldBlock: false,
        highestSeverity: null,
        violations: [],
        softFailed: false,
      }
    }

    const normalizedText = text.trim()
    const violations: ConsistencyPreflightViolation[] = []

    for (const rule of consistencyState.constraintRules) {
      const target = extractRuleTarget(rule.rule)

      if ((rule.category === "forbidden" || rule.category === "required") && target) {
        const matched = matchesTarget(normalizedText, target)
        const violated = rule.category === "forbidden" ? matched : !matched
        if (violated) {
          violations.push({
            severity: "high",
            category: rule.category,
            message:
              rule.category === "forbidden"
                ? `检测到禁止项冲突：${target}`
                : `检测到必须项缺失：${target}`,
            rule: rule.rule,
          })
        }
      }

      if (rule.category === "style") {
        violations.push({
          severity: "low",
          category: "style",
          message: `风格约束提醒：${rule.rule.slice(0, 80)}`,
          rule: rule.rule,
        })
      }
    }

    for (const event of consistencyState.timelineEvents) {
      if (event.timeAnchor === "未确认") {
        violations.push({
          severity: "medium",
          category: "timeline",
          message: `时间线锚点未确认：${event.event.slice(0, 40)}`,
        })
        break
      }
    }

    for (const state of consistencyState.characterArcStates) {
      if (
        state.motivation.includes("未知") ||
        state.relationshipStatus.includes("未知") ||
        state.secretProgress.includes("未知")
      ) {
        violations.push({
          severity: "medium",
          category: "character",
          message: `角色状态信息不完整：${state.characterName}`,
        })
        break
      }
    }

    const highestSeverity = getHighestSeverity(violations)
    return {
      shouldBlock: highestSeverity === "high",
      highestSeverity,
      violations,
      softFailed: false,
    }
  } catch {
    return {
      shouldBlock: false,
      highestSeverity: null,
      violations: [],
      softFailed: true,
    }
  }
}
