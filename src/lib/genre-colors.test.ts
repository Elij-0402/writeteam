/* @vitest-environment node */

import { describe, expect, it } from "vitest"
import { getGenreGradient, GENRES } from "./genre-colors"

describe("getGenreGradient", () => {
  it("returns a gradient string for known genres", () => {
    const result = getGenreGradient("奇幻")
    expect(result).toContain("from-")
    expect(result).toContain("to-")
  })

  it("returns neutral gradient for null/undefined genre", () => {
    expect(getGenreGradient(null)).toContain("from-muted")
    expect(getGenreGradient(undefined)).toContain("from-muted")
  })

  it("returns neutral gradient for unknown genre", () => {
    expect(getGenreGradient("未知题材")).toContain("from-muted")
  })

  it("has a mapping for every genre in the GENRES array", () => {
    for (const genre of GENRES) {
      const result = getGenreGradient(genre)
      expect(result).not.toContain("from-muted")
    }
  })
})
