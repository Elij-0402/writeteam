import { describe, it, expect } from "vitest"
import {
  createEmptyConsistencyState,
  getConsistencyFeatureFlags,
  isConsistencyPreflightEnabled,
  isStructuredContextEnabled,
} from "@/lib/story-bible/consistency"

describe("consistency types", () => {
  it("creates empty consistency state", () => {
    const state = createEmptyConsistencyState()
    expect(state.canonFacts).toEqual([])
    expect(state.timelineEvents).toEqual([])
    expect(state.characterArcStates).toEqual([])
    expect(state.constraintRules).toEqual([])
  })
})

describe("consistency flags", () => {
  it("defaults to enabled when env vars are absent", () => {
    const flags = getConsistencyFeatureFlags({})
    expect(flags.consistencyPreflight).toBe(true)
    expect(flags.structuredContext).toBe(true)
    expect(flags.postCheckEnhanced).toBe(true)
  })

  it("disables flags when set to '0'", () => {
    const flags = getConsistencyFeatureFlags({
      NEXT_PUBLIC_CONSISTENCY_PREFLIGHT: "0",
      NEXT_PUBLIC_STRUCTURED_CONTEXT: "0",
      NEXT_PUBLIC_POST_CHECK_ENHANCED: "0",
    })
    expect(flags.consistencyPreflight).toBe(false)
    expect(flags.structuredContext).toBe(false)
    expect(flags.postCheckEnhanced).toBe(false)
  })

  it("enables flags when set to '1'", () => {
    const flags = getConsistencyFeatureFlags({
      NEXT_PUBLIC_CONSISTENCY_PREFLIGHT: "1",
    })
    expect(flags.consistencyPreflight).toBe(true)
  })

  it("enables flags when set to 'true'", () => {
    expect(isConsistencyPreflightEnabled({ NEXT_PUBLIC_CONSISTENCY_PREFLIGHT: "true" })).toBe(true)
  })

  it("disables when set to 'false'", () => {
    expect(isStructuredContextEnabled({ NEXT_PUBLIC_STRUCTURED_CONTEXT: "false" })).toBe(false)
  })
})
