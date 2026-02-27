import { describe, expect, it } from "vitest"
import {
  buildCharacterCreateInput,
  hasConcurrentStoryBibleUpdate,
  mapCharacterMutationError,
  sanitizeCharacterUpdates,
  sanitizeStoryBibleUpdates,
} from "./story-bible-guards"

describe("sanitizeStoryBibleUpdates", () => {
  it("keeps only allowed story bible fields", () => {
    const result = sanitizeStoryBibleUpdates({
      genre: "奇幻",
      tone: "紧张",
      user_id: "should-not-pass",
      project_id: "should-not-pass",
      updated_at: "should-not-pass",
    })

    expect(result).toEqual({
      genre: "奇幻",
      tone: "紧张",
    })
  })
})

describe("hasConcurrentStoryBibleUpdate", () => {
  it("returns true when timestamps differ", () => {
    expect(
      hasConcurrentStoryBibleUpdate("2026-02-28T01:00:00.000Z", "2026-02-28T00:00:00.000Z")
    ).toBe(true)
  })

  it("returns false when timestamps are equal", () => {
    expect(
      hasConcurrentStoryBibleUpdate("2026-02-28T01:00:00.000Z", "2026-02-28T01:00:00.000Z")
    ).toBe(false)
  })

  it("returns false when expected timestamp is missing", () => {
    expect(hasConcurrentStoryBibleUpdate("2026-02-28T01:00:00.000Z", null)).toBe(false)
  })
})

describe("sanitizeCharacterUpdates", () => {
  it("keeps only allowed character fields", () => {
    const result = sanitizeCharacterUpdates({
      name: "阿青",
      role: "主角",
      user_id: "blocked",
      project_id: "blocked",
      updated_at: "blocked",
    })

    expect(result).toEqual({
      name: "阿青",
      role: "主角",
    })
  })
})

describe("buildCharacterCreateInput", () => {
  it("returns null when required name is missing", () => {
    const formData = new FormData()
    expect(buildCharacterCreateInput(formData)).toBeNull()
  })

  it("normalizes optional text fields", () => {
    const formData = new FormData()
    formData.set("name", "  林晚  ")
    formData.set("role", "  导师  ")
    formData.set("description", " ")
    formData.set("notes", "  讨厌甜食  ")

    expect(buildCharacterCreateInput(formData)).toEqual({
      name: "林晚",
      role: "导师",
      description: null,
      personality: null,
      appearance: null,
      backstory: null,
      goals: null,
      relationships: null,
      notes: "讨厌甜食",
    })
  })
})

describe("mapCharacterMutationError", () => {
  it("maps duplicate errors to actionable Chinese guidance", () => {
    expect(mapCharacterMutationError("duplicate key value violates unique constraint")).toContain("同名角色")
  })

  it("maps empty message to retry guidance", () => {
    expect(mapCharacterMutationError("")).toContain("请稍后重试")
  })
})
