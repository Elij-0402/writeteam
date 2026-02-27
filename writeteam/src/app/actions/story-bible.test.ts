import { describe, expect, it } from "vitest"
import {
  hasConcurrentStoryBibleUpdate,
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
