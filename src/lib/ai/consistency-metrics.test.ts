import { describe, expect, it } from "vitest"

import { computeConflictRate } from "./consistency-metrics"

describe("computeConflictRate", () => {
  it("returns per-1000-char conflict rate", () => {
    expect(computeConflictRate({ issues: 3, chars: 2500 })).toBe(1.2)
  })

  it("returns 0 for zero characters", () => {
    expect(computeConflictRate({ issues: 0, chars: 0 })).toBe(0)
  })

  it("handles fractional rates", () => {
    expect(computeConflictRate({ issues: 1, chars: 3000 })).toBeCloseTo(0.333, 2)
  })
})
