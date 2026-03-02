import { describe, expect, it } from "vitest"

import { buildStructuredContext } from "./structured-context"

describe("buildStructuredContext", () => {
  it("injects minimal structured context for writing features", () => {
    const result = buildStructuredContext(
      {
        canonFacts: [
          {
            fact: "魔法需要等价交换",
            source: "human",
            confidence: 0.9,
            updated_at: "2026-03-02T10:00:00.000Z",
          },
        ],
        timelineEvents: [
          {
            event: "第三章发生停电",
            timeAnchor: "第三章",
            participants: ["林晚"],
            stateChanges: ["旧城区断电"],
            source: "ai",
            confidence: 0.8,
            updated_at: "2026-03-03T10:00:00.000Z",
          },
        ],
        characterArcStates: [
          {
            characterName: "林晚",
            motivation: "找到姐姐",
            relationshipStatus: "与沈舟互相猜忌",
            secretProgress: "隐瞒身份",
            source: "human",
            confidence: 0.9,
            updated_at: "2026-03-02T09:00:00.000Z",
          },
          {
            characterName: "阿青",
            motivation: "保护林晚",
            relationshipStatus: "与林晚结盟",
            secretProgress: "已坦白身份",
            source: "ai",
            confidence: 0.7,
            updated_at: "2026-03-03T09:00:00.000Z",
          },
        ],
        constraintRules: [
          {
            rule: "禁止角色瞬移",
            category: "forbidden",
            source: "human",
            confidence: 1,
            updated_at: "2026-03-03T12:00:00.000Z",
          },
          {
            rule: "必须保持第一人称",
            category: "required",
            source: "human",
            confidence: 0.95,
            updated_at: "2026-03-03T11:00:00.000Z",
          },
        ],
      },
      "write"
    )

    expect(result).toContain("STRUCTURED CONTEXT")
    expect(result).toContain("Constraint rules")
    expect(result).toContain("Character arc states")
    expect(result).not.toContain("Canon facts")
    expect(result).not.toContain("Timeline events")

    expect(result.indexOf("必须保持第一人称")).toBeLessThan(result.indexOf("禁止角色瞬移"))
    expect(result.indexOf("阿青")).toBeLessThan(result.indexOf("林晚"))
  })

  it("includes planning and continuity-check sections by feature group", () => {
    const consistencyState = {
      canonFacts: [
        {
          fact: "城门午夜关闭",
          source: "human" as const,
          confidence: 0.9,
          updated_at: "2026-03-02T10:00:00.000Z",
        },
      ],
      timelineEvents: [
        {
          event: "午夜封城",
          timeAnchor: "第三章",
          participants: ["林晚"],
          stateChanges: [],
          source: "ai" as const,
          confidence: 0.8,
          updated_at: "2026-03-03T10:00:00.000Z",
        },
      ],
      characterArcStates: [
        {
          characterName: "林晚",
          motivation: "寻找真相",
          relationshipStatus: "与沈舟互相试探",
          secretProgress: "尚未坦白",
          source: "human" as const,
          confidence: 0.9,
          updated_at: "2026-03-03T09:00:00.000Z",
        },
      ],
      constraintRules: [
        {
          rule: "必须保持第一人称",
          category: "required" as const,
          source: "human" as const,
          confidence: 1,
          updated_at: "2026-03-03T12:00:00.000Z",
        },
      ],
    }

    const planning = buildStructuredContext(consistencyState, "scene-plan")
    expect(planning).toContain("Character arc states")
    expect(planning).toContain("Timeline events")
    expect(planning).not.toContain("Constraint rules")
    expect(planning).not.toContain("Canon facts")

    const continuityCheck = buildStructuredContext(consistencyState, "continuity-check")
    expect(continuityCheck).toContain("Constraint rules")
    expect(continuityCheck).toContain("Character arc states")
    expect(continuityCheck).toContain("Timeline events")
    expect(continuityCheck).toContain("Canon facts")
  })
})
