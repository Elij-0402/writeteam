import { describe, expect, it } from "vitest"

import {
  isEditorFocusEnhancementEnabled,
  isEditorQuickEditReuseEnabled,
} from "@/lib/editor/editor-experience-flags"

describe("editor-experience-flags", () => {
  it("disables focus enhancement when env flag is 0", () => {
    expect(isEditorFocusEnhancementEnabled({ NEXT_PUBLIC_EDITOR_FOCUS: "0" })).toBe(false)
  })

  it("enables focus enhancement by default", () => {
    expect(isEditorFocusEnhancementEnabled({})).toBe(true)
  })

  it("disables quick-reuse enhancement when env flag is 0", () => {
    expect(isEditorQuickEditReuseEnabled({ NEXT_PUBLIC_EDITOR_QUICK_REUSE: "0" })).toBe(false)
  })

  it("enables quick-reuse enhancement by default", () => {
    expect(isEditorQuickEditReuseEnabled({})).toBe(true)
  })
})
