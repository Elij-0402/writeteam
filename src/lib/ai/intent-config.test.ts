import { describe, it, expect } from "vitest"
import {
  type AIIntent,
  type RouteCategory,

  INTENT_CONFIGS,
  getIntentConfig,
  getIntentsByCategory,
} from "./intent-config"

// ---------------------------------------------------------------------------
// Basic lookup
// ---------------------------------------------------------------------------

describe("getIntentConfig", () => {
  it("returns config for a known intent", () => {
    const cfg = getIntentConfig("write")
    expect(cfg).toBeDefined()
    expect(cfg!.intent).toBe("write")
    expect(cfg!.category).toBe("write")
  })

  it("returns undefined for an unknown intent", () => {
    const cfg = getIntentConfig("nonexistent" as AIIntent)
    expect(cfg).toBeUndefined()
  })

  it("returns correct config values for write intent", () => {
    const cfg = getIntentConfig("write")!
    expect(cfg.temperature).toBe(0.8)
    expect(cfg.maxTokens).toBe(1000)
    expect(cfg.streaming).toBe(true)
    expect(cfg.contextLevel).toBe("full")
    expect(cfg.consistencyPreflight).toBe(true)
    expect(cfg.feature).toBe("write")
  })

  it("returns correct config values for quick-edit intent", () => {
    const cfg = getIntentConfig("quick-edit")!
    expect(cfg.temperature).toBe(0.7)
    expect(cfg.maxTokens).toBe(1500)
    expect(cfg.streaming).toBe(true)
    expect(cfg.contextLevel).toBe("full")
    expect(cfg.consistencyPreflight).toBe(true)
    expect(cfg.category).toBe("edit")
  })

  it("returns correct config values for continuity-check intent", () => {
    const cfg = getIntentConfig("continuity-check")!
    expect(cfg.temperature).toBe(0.3)
    expect(cfg.maxTokens).toBe(1500)
    expect(cfg.streaming).toBe(true)
    expect(cfg.contextLevel).toBe("full")
    expect(cfg.consistencyPreflight).toBe(false)
    expect(cfg.category).toBe("check")
  })

  it("returns correct config values for chat intent", () => {
    const cfg = getIntentConfig("chat")!
    expect(cfg.temperature).toBe(0.7)
    expect(cfg.maxTokens).toBe(1000)
    expect(cfg.streaming).toBe(true)
    expect(cfg.contextLevel).toBe("summary")
    expect(cfg.consistencyPreflight).toBe(false)
    expect(cfg.category).toBe("chat")
  })

  it("returns correct config values for scene-plan intent", () => {
    const cfg = getIntentConfig("scene-plan")!
    expect(cfg.temperature).toBe(0.7)
    expect(cfg.maxTokens).toBe(1500)
    expect(cfg.streaming).toBe(true)
    expect(cfg.contextLevel).toBe("summary")
    expect(cfg.consistencyPreflight).toBe(false)
    expect(cfg.category).toBe("plan")
  })

  it("returns correct config for saliency (non-streaming)", () => {
    const cfg = getIntentConfig("saliency")!
    expect(cfg.streaming).toBe(false)
    expect(cfg.contextLevel).toBe("minimal")
    expect(cfg.category).toBe("check")
  })

  it("returns correct config for canvas-generate (non-streaming)", () => {
    const cfg = getIntentConfig("canvas-generate")!
    expect(cfg.streaming).toBe(false)
    expect(cfg.contextLevel).toBe("summary")
    expect(cfg.category).toBe("plan")
  })

  it("returns correct config for visualize (non-streaming)", () => {
    const cfg = getIntentConfig("visualize")!
    expect(cfg.streaming).toBe(false)
    expect(cfg.contextLevel).toBe("minimal")
    expect(cfg.category).toBe("plan")
  })
})

// ---------------------------------------------------------------------------
// Category filtering
// ---------------------------------------------------------------------------

describe("getIntentsByCategory", () => {
  it("returns 4 write intents", () => {
    const configs = getIntentsByCategory("write")
    expect(configs).toHaveLength(4)
    const intents = configs.map((c) => c.intent).sort()
    expect(intents).toEqual(["describe", "expand", "first-draft", "write"])
  })

  it("returns 4 edit intents", () => {
    const configs = getIntentsByCategory("edit")
    expect(configs).toHaveLength(4)
    const intents = configs.map((c) => c.intent).sort()
    expect(intents).toEqual(["quick-edit", "rewrite", "shrink", "tone-shift"])
  })

  it("returns 2 check intents", () => {
    const configs = getIntentsByCategory("check")
    expect(configs).toHaveLength(2)
    const intents = configs.map((c) => c.intent).sort()
    expect(intents).toEqual(["continuity-check", "saliency"])
  })

  it("returns 5 chat intents", () => {
    const configs = getIntentsByCategory("chat")
    expect(configs).toHaveLength(5)
    const intents = configs.map((c) => c.intent).sort()
    expect(intents).toEqual([
      "bible-assist",
      "brainstorm",
      "chat",
      "muse",
      "twist",
    ])
  })

  it("returns 3 plan intents", () => {
    const configs = getIntentsByCategory("plan")
    expect(configs).toHaveLength(3)
    const intents = configs.map((c) => c.intent).sort()
    expect(intents).toEqual(["canvas-generate", "scene-plan", "visualize"])
  })

  it("returns empty array for unknown category", () => {
    const configs = getIntentsByCategory("unknown" as RouteCategory)
    expect(configs).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Structural integrity
// ---------------------------------------------------------------------------

describe("INTENT_CONFIGS", () => {
  it("contains exactly 18 entries", () => {
    expect(INTENT_CONFIGS).toHaveLength(18)
  })

  it("every entry has all required fields", () => {
    for (const cfg of INTENT_CONFIGS) {
      expect(cfg.intent).toBeTypeOf("string")
      expect(cfg.feature).toBeTypeOf("string")
      expect(cfg.category).toBeTypeOf("string")
      expect(cfg.temperature).toBeTypeOf("number")
      expect(cfg.maxTokens).toBeTypeOf("number")
      expect(cfg.streaming).toBeTypeOf("boolean")
      expect(["full", "summary", "minimal"]).toContain(cfg.contextLevel)
      expect(cfg.consistencyPreflight).toBeTypeOf("boolean")
    }
  })

  it("has no duplicate intents", () => {
    const intents = INTENT_CONFIGS.map((c) => c.intent)
    expect(new Set(intents).size).toBe(intents.length)
  })

  it("all temperatures are between 0 and 2", () => {
    for (const cfg of INTENT_CONFIGS) {
      expect(cfg.temperature).toBeGreaterThanOrEqual(0)
      expect(cfg.temperature).toBeLessThanOrEqual(2)
    }
  })

  it("all maxTokens are positive", () => {
    for (const cfg of INTENT_CONFIGS) {
      expect(cfg.maxTokens).toBeGreaterThan(0)
    }
  })

  it("only write and quick-edit have consistencyPreflight enabled", () => {
    const preflighted = INTENT_CONFIGS.filter((c) => c.consistencyPreflight)
    expect(preflighted).toHaveLength(2)
    const intents = preflighted.map((c) => c.intent).sort()
    expect(intents).toEqual(["quick-edit", "write"])
  })
})
