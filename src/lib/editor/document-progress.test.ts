import { describe, expect, it } from "vitest"

import { getDocumentProgressTag, isDocumentRecentlyEdited } from "@/lib/editor/document-progress"
import type { Document } from "@/types/database"

function createDocumentProgressInput(wordCount: number): Pick<Document, "word_count"> {
  return {
    word_count: wordCount,
  }
}

function createRecentEditInput(updatedAt: string): Pick<Document, "updated_at"> {
  return {
    updated_at: updatedAt,
  }
}

describe("getDocumentProgressTag", () => {
  it("returns unfinished for short drafts", () => {
    expect(getDocumentProgressTag(createDocumentProgressInput(299))).toBe("unfinished")
  })

  it("returns drafting for medium-length drafts", () => {
    expect(getDocumentProgressTag(createDocumentProgressInput(300))).toBe("drafting")
    expect(getDocumentProgressTag(createDocumentProgressInput(1499))).toBe("drafting")
  })

  it("returns stable for long chapters", () => {
    expect(getDocumentProgressTag(createDocumentProgressInput(1500))).toBe("stable")
  })

  it("treats negative or invalid counts as unfinished", () => {
    expect(getDocumentProgressTag(createDocumentProgressInput(-20))).toBe("unfinished")
    expect(getDocumentProgressTag(createDocumentProgressInput(Number.NaN))).toBe("unfinished")
  })
})

describe("isDocumentRecentlyEdited", () => {
  const now = Date.parse("2025-01-02T00:00:00.000Z")
  const recentWindowMs = 24 * 60 * 60 * 1000

  it("returns true when updated within recent window", () => {
    expect(
      isDocumentRecentlyEdited(
        createRecentEditInput("2025-01-01T12:00:00.000Z"),
        now,
        recentWindowMs
      )
    ).toBe(true)
  })

  it("returns false when updated outside recent window", () => {
    expect(
      isDocumentRecentlyEdited(
        createRecentEditInput("2024-12-31T00:00:00.000Z"),
        now,
        recentWindowMs
      )
    ).toBe(false)
  })

  it("returns false for invalid updated_at", () => {
    expect(
      isDocumentRecentlyEdited(
        createRecentEditInput("not-a-date"),
        now,
        recentWindowMs
      )
    ).toBe(false)
  })

  it("returns false when updated_at is in the future", () => {
    expect(
      isDocumentRecentlyEdited(
        createRecentEditInput("2025-01-03T00:00:00.000Z"),
        now,
        recentWindowMs
      )
    ).toBe(false)
  })
})
