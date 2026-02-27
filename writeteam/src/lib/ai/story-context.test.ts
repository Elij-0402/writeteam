import { describe, expect, it, vi } from "vitest"
import { buildStoryPromptContext, fetchStoryContext } from "./story-context"

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
})
