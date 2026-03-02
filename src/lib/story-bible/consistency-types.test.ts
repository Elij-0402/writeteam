import { describe, expect, it } from "vitest"

import { createEmptyConsistencyState } from "@/lib/story-bible/consistency-types"

describe("createEmptyConsistencyState", () => {
  it("returns the default empty consistency state", () => {
    expect(createEmptyConsistencyState()).toEqual({
      characters: [],
      locations: [],
      items: [],
      rules: [],
    })
  })
})
