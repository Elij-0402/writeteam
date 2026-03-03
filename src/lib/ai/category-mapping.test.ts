import { describe, it, expect } from "vitest"
import { getEndpointForFeature } from "@/lib/ai/category-mapping"

describe("category-mapping", () => {
  it("maps write features to /api/ai/write", () => {
    expect(getEndpointForFeature("write")).toBe("/api/ai/write")
    expect(getEndpointForFeature("expand")).toBe("/api/ai/write")
    expect(getEndpointForFeature("first-draft")).toBe("/api/ai/write")
    expect(getEndpointForFeature("describe")).toBe("/api/ai/write")
  })

  it("maps edit features to /api/ai/edit", () => {
    expect(getEndpointForFeature("quick-edit")).toBe("/api/ai/edit")
    expect(getEndpointForFeature("rewrite")).toBe("/api/ai/edit")
    expect(getEndpointForFeature("shrink")).toBe("/api/ai/edit")
    expect(getEndpointForFeature("tone-shift")).toBe("/api/ai/edit")
  })

  it("maps check features to /api/ai/check", () => {
    expect(getEndpointForFeature("continuity-check")).toBe("/api/ai/check")
    expect(getEndpointForFeature("saliency")).toBe("/api/ai/check")
  })

  it("maps chat features to /api/ai/chat", () => {
    expect(getEndpointForFeature("chat")).toBe("/api/ai/chat")
    expect(getEndpointForFeature("brainstorm")).toBe("/api/ai/chat")
    expect(getEndpointForFeature("twist")).toBe("/api/ai/chat")
    expect(getEndpointForFeature("muse")).toBe("/api/ai/chat")
    expect(getEndpointForFeature("bible-assist")).toBe("/api/ai/chat")
  })

  it("maps plan features to /api/ai/plan", () => {
    expect(getEndpointForFeature("scene-plan")).toBe("/api/ai/plan")
    expect(getEndpointForFeature("canvas-generate")).toBe("/api/ai/plan")
    expect(getEndpointForFeature("visualize")).toBe("/api/ai/plan")
  })

  it("preserves independent endpoints", () => {
    expect(getEndpointForFeature("plugin")).toBe("/api/ai/plugin")
    expect(getEndpointForFeature("models")).toBe("/api/ai/models")
    expect(getEndpointForFeature("test-connection")).toBe("/api/ai/test-connection")
  })

  it("falls back to direct path for unknown features", () => {
    expect(getEndpointForFeature("unknown-feature")).toBe("/api/ai/unknown-feature")
  })
})
