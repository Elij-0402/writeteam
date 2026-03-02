import { describe, expect, it } from "vitest"

import { extractConsistencyState } from "@/lib/story-bible/consistency-extractor"

describe("extractConsistencyState", () => {
  it("extracts a baseline consistency state from legacy bible and characters", () => {
    const result = extractConsistencyState({
      bible: {
        worldbuilding: "魔法需要等价交换",
        notes: "时间线：第三章夜里发生停电",
        outline: ["第一章：入学", "第二章：冲突升级"],
      },
      characters: [
        {
          name: "林晚",
          goals: "找到失踪的姐姐",
          relationships: "与沈舟互相猜忌",
          notes: "隐瞒真实身份",
        },
      ],
    })

    expect(result.canonFacts[0]).toMatchObject({
      fact: expect.stringContaining("魔法需要等价交换"),
      source: "ai",
    })
    expect(result.constraintRules[0]).toMatchObject({
      rule: expect.stringContaining("魔法需要等价交换"),
      category: "required",
    })
    expect(result.timelineEvents[0]).toMatchObject({
      event: expect.stringContaining("第一章：入学"),
      participants: [],
    })
    expect(result.characterArcStates[0]).toMatchObject({
      characterName: "林晚",
      motivation: expect.stringContaining("找到失踪的姐姐"),
      relationshipStatus: expect.stringContaining("互相猜忌"),
    })
  })

  it("returns empty fallback when legacy content is unusable", () => {
    const result = extractConsistencyState({
      bible: {
        worldbuilding: "",
        notes: null,
        outline: undefined,
      },
      characters: [],
    })

    expect(result).toEqual({
      canonFacts: [],
      timelineEvents: [],
      characterArcStates: [],
      constraintRules: [],
    })
  })

  it("marks low-confidence extraction with pendingConfirmation marker", () => {
    const result = extractConsistencyState({
      bible: {
        notes: "可能在旧港口发生过火灾",
      },
      characters: [],
    })

    expect(result.canonFacts[0]?.fact).toContain("[pendingConfirmation]")
    expect(result.canonFacts[0]?.confidence).toBeLessThan(0.5)
  })
})
