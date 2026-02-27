import { describe, expect, it } from "vitest"
import { buildStoryPromptContext } from "./story-context"

describe("buildStoryPromptContext", () => {
  it("respects visibility.characters switch", () => {
    const result = buildStoryPromptContext(
      {
        bible: {
          genre: null,
          style: null,
          prose_mode: null,
          style_sample: null,
          synopsis: null,
          themes: null,
          setting: null,
          pov: null,
          tense: null,
          worldbuilding: null,
          outline: null,
          notes: null,
          braindump: null,
          tone: null,
          ai_rules: null,
          visibility: { characters: false },
        },
        characters: [
          {
            name: "林晚",
            role: "主角",
            description: "冷静",
            personality: "克制",
            appearance: null,
            backstory: null,
            goals: null,
            relationships: null,
            notes: null,
          },
        ],
      },
      { feature: "write" }
    )

    expect(result.fullContext).not.toContain("CHARACTERS:")
  })

  it("injects planning-only character fields for planning features", () => {
    const result = buildStoryPromptContext(
      {
        bible: null,
        characters: [
          {
            name: "沈舟",
            role: "反派",
            description: "城府极深",
            personality: "谨慎",
            appearance: "黑色风衣",
            backstory: "旧案幸存者",
            goals: "夺回控制权",
            relationships: "与林晚对立",
            notes: "不喝酒",
          },
        ],
      },
      { feature: "brainstorm" }
    )

    expect(result.fullContext).toContain("Goals: 夺回控制权")
    expect(result.fullContext).toContain("Relationships: 与林晚对立")
    expect(result.fullContext).not.toContain("Backstory")
    expect(result.fullContext).not.toContain("Appearance")
  })

  it("adds character health notice for duplicate names", () => {
    const result = buildStoryPromptContext(
      {
        bible: {
          genre: null,
          style: null,
          prose_mode: null,
          style_sample: null,
          synopsis: null,
          themes: null,
          setting: null,
          pov: null,
          tense: null,
          worldbuilding: null,
          outline: null,
          notes: null,
          braindump: null,
          tone: null,
          ai_rules: null,
          visibility: { characters: true },
        },
        characters: [
          {
            name: "阿青",
            role: "主角",
            description: null,
            personality: null,
            appearance: null,
            backstory: null,
            goals: null,
            relationships: null,
            notes: null,
          },
          {
            name: "阿青",
            role: "配角",
            description: "观察者",
            personality: null,
            appearance: null,
            backstory: null,
            goals: null,
            relationships: null,
            notes: null,
          },
        ],
      },
      { feature: "chat" }
    )

    expect(result.fullContext).toContain("CHARACTER CONTEXT NOTICE")
    expect(result.fullContext).toContain("同名角色")
    expect(result.fullContext).toContain("缺少“描述/性格”")
  })
})
