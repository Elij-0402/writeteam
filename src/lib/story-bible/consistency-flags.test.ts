import { describe, expect, it } from "vitest"

import {
  getConsistencyFeatureFlags,
  isConsistencyPreflightEnabled,
  isPostCheckEnhancedEnabled,
  isStructuredContextEnabled,
} from "@/lib/story-bible/consistency-flags"

describe("consistency flags", () => {
  it("returns false when structured context flag is 0", () => {
    expect(
      isStructuredContextEnabled({
        NEXT_PUBLIC_STRUCTURED_CONTEXT: "0",
      })
    ).toBe(false)
  })

  it("parses preflight and post-check flags explicitly", () => {
    expect(
      isConsistencyPreflightEnabled({
        NEXT_PUBLIC_CONSISTENCY_PREFLIGHT: "false",
      })
    ).toBe(false)

    expect(
      isPostCheckEnhancedEnabled({
        NEXT_PUBLIC_POST_CHECK_ENHANCED: "1",
      })
    ).toBe(true)
  })

  it("normalizes flag tokens with trim and case-insensitive parsing", () => {
    expect(
      isStructuredContextEnabled({
        NEXT_PUBLIC_STRUCTURED_CONTEXT: "  TrUe  ",
      })
    ).toBe(true)

    expect(
      isConsistencyPreflightEnabled({
        NEXT_PUBLIC_CONSISTENCY_PREFLIGHT: "  OFF ",
      })
    ).toBe(false)
  })

  it("falls back to defaults for unknown and empty tokens", () => {
    expect(
      isPostCheckEnhancedEnabled({
        NEXT_PUBLIC_POST_CHECK_ENHANCED: "maybe",
      })
    ).toBe(true)

    expect(
      isStructuredContextEnabled({
        NEXT_PUBLIC_STRUCTURED_CONTEXT: "   ",
      })
    ).toBe(true)
  })

  it("keeps compatibility defaults enabled when flags are missing", () => {
    expect(getConsistencyFeatureFlags({})).toEqual({
      consistencyPreflight: true,
      structuredContext: true,
      postCheckEnhanced: true,
    })
  })

  it("returns merged defaults across all flags", () => {
    expect(
      getConsistencyFeatureFlags({
        NEXT_PUBLIC_CONSISTENCY_PREFLIGHT: "no",
        NEXT_PUBLIC_STRUCTURED_CONTEXT: "yes",
        NEXT_PUBLIC_POST_CHECK_ENHANCED: "disabled",
      })
    ).toEqual({
      consistencyPreflight: false,
      structuredContext: true,
      postCheckEnhanced: false,
    })
  })
})
