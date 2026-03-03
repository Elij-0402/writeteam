import { describe, expect, it } from "vitest"

import { runConsistencyPreflight } from "./consistency-preflight"

describe("runConsistencyPreflight", () => {
  it("flags high severity when forbidden rule is violated", () => {
    const result = runConsistencyPreflight({
      text: "他在满月之夜直接施展了传送术，瞬间跨城。",
      consistencyState: {
        canonFacts: [],
        timelineEvents: [],
        characterArcStates: [],
        constraintRules: [
          {
            rule: "禁止使用传送术",
            category: "forbidden",
            source: "human",
            confidence: 1,
            updated_at: "2026-03-03T10:00:00.000Z",
          },
        ],
      },
    })

    expect(result.shouldBlock).toBe(true)
    expect(result.highestSeverity).toBe("high")
    expect(result.violations[0]).toMatchObject({
      severity: "high",
      category: "forbidden",
    })
  })

  it("classifies medium and low severity findings", () => {
    const result = runConsistencyPreflight({
      text: "她推门走入雨夜。",
      consistencyState: {
        canonFacts: [],
        timelineEvents: [
          {
            event: "第三章黎明出发",
            timeAnchor: "未确认",
            participants: ["林晚"],
            stateChanges: [],
            source: "ai",
            confidence: 0.6,
            updated_at: "2026-03-03T10:00:00.000Z",
          },
        ],
        characterArcStates: [],
        constraintRules: [
          {
            rule: "保持克制冷静的叙事风格",
            category: "style",
            source: "human",
            confidence: 1,
            updated_at: "2026-03-03T10:00:00.000Z",
          },
        ],
      },
    })

    expect(result.shouldBlock).toBe(false)
    expect(result.highestSeverity).toBe("medium")
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "medium", category: "timeline" }),
        expect.objectContaining({ severity: "low", category: "style" }),
      ])
    )
  })

  it("soft-fails when runtime parsing throws", () => {
    const result = runConsistencyPreflight({
      text: "测试",
      consistencyState: {
        canonFacts: [],
        timelineEvents: [],
        characterArcStates: [],
        constraintRules: [
          {
            get rule(): string {
              throw new Error("boom")
            },
            category: "forbidden",
            source: "human",
            confidence: 1,
            updated_at: "2026-03-03T10:00:00.000Z",
          },
        ],
      },
    })

    expect(result.softFailed).toBe(true)
    expect(result.shouldBlock).toBe(false)
    expect(result.violations).toEqual([])
  })
})
