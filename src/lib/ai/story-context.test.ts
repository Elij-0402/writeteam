import { describe, expect, it, vi } from "vitest"
import { buildStoryPromptContext, fetchStoryContext } from "./story-context"

describe("buildStoryPromptContext", () => {
  it("keeps saliency-only context when story data is empty", () => {
    const result = buildStoryPromptContext(
      {
        bible: null,
        characters: [],
      },
      {
        feature: "write",
        saliencyMap: {
          activeCharacters: ["林晚"],
          activeLocations: [],
          activePlotlines: [],
        },
      }
    )

    expect(result.fullContext).toContain("SCENE SALIENCY")
    expect(result.fullContext).toContain("Active characters in scene: 林晚")
  })

  it("keeps prose override guidance when story data is empty", () => {
    const result = buildStoryPromptContext(
      {
        bible: null,
        characters: [],
      },
      {
        feature: "write",
        proseMode: "cinematic",
      }
    )

    expect(result.fullContext).toContain("PROSE STYLE GUIDANCE")
    expect(result.fullContext).toContain("Use visual, momentum-driven prose")
  })

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

  it("returns actionable notice when characters are hidden by visibility", () => {
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
      { feature: "chat" }
    )

    expect(result.fullContext).not.toContain("CHARACTERS:")
    expect(result.fullContext).toContain("角色上下文已关闭")
  })

  it("keeps visibility filtering consistent across feature groups", () => {
    const baseContext = {
      bible: {
        genre: null,
        style: null,
        prose_mode: null,
        style_sample: null,
        synopsis: "这是梗概",
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
        visibility: { synopsis: false },
      },
      characters: [],
    }

    const writing = buildStoryPromptContext(baseContext, { feature: "write" })
    const planning = buildStoryPromptContext(baseContext, { feature: "brainstorm" })
    const checking = buildStoryPromptContext(baseContext, { feature: "continuity-check" })
    const chatting = buildStoryPromptContext(baseContext, { feature: "chat" })

    expect(writing.fullContext).not.toContain("STORY SYNOPSIS")
    expect(planning.fullContext).not.toContain("STORY SYNOPSIS")
    expect(checking.fullContext).not.toContain("STORY SYNOPSIS")
    expect(chatting.fullContext).not.toContain("STORY SYNOPSIS")
  })

  it("injects minimal structured context for writing features", () => {
    const result = buildStoryPromptContext(
      {
        bible: null,
        characters: [],
        consistencyState: {
          canonFacts: [
            {
              fact: "魔法需要等价交换",
              source: "human",
              confidence: 0.9,
              updated_at: "2026-03-03T10:00:00.000Z",
            },
          ],
          timelineEvents: [
            {
              event: "第三章发生停电",
              timeAnchor: "第三章",
              participants: ["林晚"],
              stateChanges: [],
              source: "ai",
              confidence: 0.8,
              updated_at: "2026-03-03T11:00:00.000Z",
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
              updated_at: "2026-03-03T12:00:00.000Z",
            },
          ],
          constraintRules: [
            {
              rule: "必须保持第一人称",
              category: "required",
              source: "human",
              confidence: 1,
              updated_at: "2026-03-03T13:00:00.000Z",
            },
          ],
        },
      },
      { feature: "write" }
    )

    expect(result.fullContext).toContain("STRUCTURED CONTEXT")
    expect(result.fullContext).toContain("Constraint rules")
    expect(result.fullContext).toContain("Character arc states")
    expect(result.fullContext).not.toContain("Timeline events")
  })

  it("includes dialogue_style in character guidance for writing features", () => {
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
          visibility: null,
        },
        characters: [
          {
            name: "林晚",
            role: "主角",
            description: "侦探",
            personality: "冷静",
            appearance: "黑发",
            backstory: null,
            goals: null,
            relationships: null,
            notes: null,
            dialogue_style: "喜欢用反问句，口头禅是「你确定？」",
          },
        ],
      },
      { feature: "write" }
    )
    expect(result.fullContext).toContain("喜欢用反问句")
  })

  it("includes dialogue_style in character guidance for chat features", () => {
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
          visibility: null,
        },
        characters: [
          {
            name: "林晚",
            role: "主角",
            description: "侦探",
            personality: "冷静",
            appearance: "黑发",
            backstory: null,
            goals: null,
            relationships: null,
            notes: null,
            dialogue_style: "简洁有力，不说废话",
          },
        ],
      },
      { feature: "chat" }
    )
    expect(result.fullContext).toContain("简洁有力")
  })

  it("parses structured worldbuilding sections in prompt", () => {
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
          worldbuilding: "[地理环境]\n山脉纵横\n\n[能力体系]\n内力修炼",
          outline: null,
          notes: null,
          braindump: null,
          tone: null,
          ai_rules: null,
          visibility: null,
        },
        characters: [],
      },
      { feature: "write" }
    )
    expect(result.fullContext).toContain("### 地理环境")
    expect(result.fullContext).toContain("山脉纵横")
    expect(result.fullContext).toContain("### 能力体系")
    expect(result.fullContext).toContain("内力修炼")
  })

  it("renders flat worldbuilding text without sub-headers", () => {
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
          worldbuilding: "魔法需要等价交换",
          outline: null,
          notes: null,
          braindump: null,
          tone: null,
          ai_rules: null,
          visibility: null,
        },
        characters: [],
      },
      { feature: "write" }
    )
    expect(result.fullContext).toContain("WORLD RULES")
    expect(result.fullContext).toContain("魔法需要等价交换")
    expect(result.fullContext).not.toContain("###")
  })

  it("hides structured character arc states when characters visibility is false", () => {
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
        characters: [],
        consistencyState: {
          canonFacts: [],
          timelineEvents: [],
          characterArcStates: [
            {
              characterName: "林晚",
              motivation: "找到姐姐",
              relationshipStatus: "与沈舟互相猜忌",
              secretProgress: "隐瞒身份",
              source: "human",
              confidence: 0.9,
              updated_at: "2026-03-03T12:00:00.000Z",
            },
          ],
          constraintRules: [],
        },
      },
      { feature: "write" }
    )

    expect(result.fullContext).not.toContain("Character arc states")
    expect(result.fullContext).not.toContain("林晚")
  })
})

describe("fetchStoryContext", () => {
  it("uses series bible as fallback when project bible is missing", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "story_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { code: "PGRST116" } }),
              }),
            }),
          }
        }
        if (table === "characters") {
          return {
            select: () => ({
              eq: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { series_id: "series-1" }, error: null }),
              }),
            }),
          }
        }
        if (table === "series_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    genre: "奇幻",
                    style: "抒情",
                    themes: "牺牲",
                    setting: "边陲王国",
                    worldbuilding: "魔法守则",
                    notes: "共享设定",
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table: ${table}`)
      }),
    }

    const result = await fetchStoryContext(supabase as never, "project-1")

    expect(result.bible?.genre).toBe("奇幻")
    expect(result.bible?.style).toBe("抒情")
    expect(result.bible?.themes).toBe("牺牲")
  })

  it("keeps project fields over series fallback values", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "story_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    genre: "科幻",
                    style: null,
                    prose_mode: null,
                    style_sample: null,
                    synopsis: null,
                    themes: "身份",
                    setting: null,
                    pov: null,
                    tense: null,
                    worldbuilding: null,
                    outline: null,
                    notes: null,
                    braindump: null,
                    tone: null,
                    ai_rules: null,
                    visibility: null,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "characters") {
          return {
            select: () => ({
              eq: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { series_id: "series-1" }, error: null }),
              }),
            }),
          }
        }
        if (table === "series_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    genre: "奇幻",
                    style: "抒情",
                    themes: "牺牲",
                    setting: "边陲王国",
                    worldbuilding: "魔法守则",
                    notes: "共享设定",
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table: ${table}`)
      }),
    }

    const result = await fetchStoryContext(supabase as never, "project-1")

    expect(result.bible?.genre).toBe("科幻")
    expect(result.bible?.themes).toBe("身份")
    expect(result.bible?.style).toBe("抒情")
    expect(result.bible?.setting).toBe("边陲王国")
  })

  it("keeps explicit empty-string project fields over series fallback values", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "story_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    genre: "",
                    style: "",
                    prose_mode: null,
                    style_sample: null,
                    synopsis: null,
                    themes: "",
                    setting: "",
                    pov: null,
                    tense: null,
                    worldbuilding: "",
                    outline: null,
                    notes: "",
                    braindump: null,
                    tone: null,
                    ai_rules: null,
                    visibility: null,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "characters") {
          return {
            select: () => ({
              eq: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { series_id: "series-1" }, error: null }),
              }),
            }),
          }
        }
        if (table === "series_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    genre: "奇幻",
                    style: "抒情",
                    themes: "牺牲",
                    setting: "边陲王国",
                    worldbuilding: "魔法守则",
                    notes: "共享设定",
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table: ${table}`)
      }),
    }

    const result = await fetchStoryContext(supabase as never, "project-1")

    expect(result.bible?.genre).toBe("")
    expect(result.bible?.style).toBe("")
    expect(result.bible?.themes).toBe("")
    expect(result.bible?.setting).toBe("")
    expect(result.bible?.worldbuilding).toBe("")
    expect(result.bible?.notes).toBe("")
  })

  it("adds explicit user_id filters when userId is provided", async () => {
    const calls: Array<[string, string]> = []
    const buildSingleQuery = (data: unknown) => {
      const query = {
        eq: vi.fn((column: string, value: string) => {
          calls.push([column, value])
          return query
        }),
        single: vi.fn(async () => ({ data, error: null })),
      }
      return query
    }
    const buildLimitQuery = (data: unknown) => {
      const query = {
        eq: vi.fn((column: string, value: string) => {
          calls.push([column, value])
          return query
        }),
        limit: vi.fn(async () => ({ data, error: null })),
      }
      return query
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "story_bibles") {
          return { select: () => buildSingleQuery(null) }
        }
        if (table === "characters") {
          return { select: () => buildLimitQuery([]) }
        }
        if (table === "projects") {
          return { select: () => buildSingleQuery({ series_id: "series-1" }) }
        }
        if (table === "series_bibles") {
          return { select: () => buildSingleQuery({ notes: "共享设定" }) }
        }
        throw new Error(`unexpected table: ${table}`)
      }),
    }

    await fetchStoryContext(supabase as never, "project-1", "user-1")

    const userIdScopedCalls = calls.filter(([column, value]) => column === "user_id" && value === "user-1")
    expect(userIdScopedCalls.length).toBe(4)
  })

  it("does not apply series fallback when story bible query fails generically", async () => {
    const requestedTables: string[] = []

    const supabase = {
      from: vi.fn((table: string) => {
        requestedTables.push(table)

        if (table === "story_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { code: "XX000" } }),
              }),
            }),
          }
        }
        if (table === "characters") {
          return {
            select: () => ({
              eq: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { series_id: "series-1" }, error: null }),
              }),
            }),
          }
        }
        if (table === "series_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { genre: "奇幻" }, error: null }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table: ${table}`)
      }),
    }

    const result = await fetchStoryContext(supabase as never, "project-1")

    expect(result.bible).toBeNull()
    expect(requestedTables).not.toContain("series_bibles")
  })

  it("does not query series bible when project query errors", async () => {
    const requestedTables: string[] = []

    const supabase = {
      from: vi.fn((table: string) => {
        requestedTables.push(table)

        if (table === "story_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { code: "PGRST116" } }),
              }),
            }),
          }
        }
        if (table === "characters") {
          return {
            select: () => ({
              eq: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { code: "42501" } }),
              }),
            }),
          }
        }
        if (table === "series_bibles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { genre: "奇幻" }, error: null }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table: ${table}`)
      }),
    }

    const result = await fetchStoryContext(supabase as never, "project-1")

    expect(result.bible).toBeNull()
    expect(requestedTables).not.toContain("series_bibles")
  })
})
