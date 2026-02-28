import { describe, expect, it } from "vitest"
import { buildStoryPromptContext } from "./story-context"
import type { StoryContext, SaliencyMap } from "./story-context"

// Helper: minimal bible stub with all null fields
function nullBible() {
  return {
    genre: null,
    style: null,
    prose_mode: null,
    style_sample: null,
    synopsis: null,
    themes: null,
    setting: null,
    pov: null,
    tense: null,
    worldbuilding: null,
    outline: null,
    notes: null,
    braindump: null,
    tone: null,
    ai_rules: null,
    visibility: null,
  }
}

// ---------------------------------------------------------------------------
// Saliency integration
// ---------------------------------------------------------------------------

describe("saliencyMap integration in buildStoryPromptContext", () => {
  const saliency: SaliencyMap = {
    activeCharacters: ["林晚", "沈舟"],
    activeLocations: ["码头"],
    activePlotlines: ["追踪线索"],
  }

  it("includes saliency guidance for write feature when saliencyMap is provided", () => {
    const ctx: StoryContext = {
      bible: { ...nullBible(), genre: "悬疑" },
      characters: [],
    }
    const result = buildStoryPromptContext(ctx, {
      feature: "write",
      saliencyMap: saliency,
    })

    expect(result.fullContext).toContain("SCENE SALIENCY")
    expect(result.fullContext).toContain("林晚")
    expect(result.fullContext).toContain("沈舟")
    expect(result.fullContext).toContain("码头")
    expect(result.fullContext).toContain("追踪线索")
  })

  it("includes saliency guidance for rewrite feature", () => {
    const ctx: StoryContext = { bible: nullBible(), characters: [] }
    const result = buildStoryPromptContext(ctx, {
      feature: "rewrite",
      saliencyMap: saliency,
    })

    expect(result.fullContext).toContain("SCENE SALIENCY")
    expect(result.fullContext).toContain("Active characters in scene")
  })

  it("includes saliency guidance for expand feature", () => {
    const ctx: StoryContext = { bible: nullBible(), characters: [] }
    const result = buildStoryPromptContext(ctx, {
      feature: "expand",
      saliencyMap: saliency,
    })

    expect(result.fullContext).toContain("SCENE SALIENCY")
  })

  it("includes saliency guidance for shrink feature", () => {
    const ctx: StoryContext = { bible: nullBible(), characters: [] }
    const result = buildStoryPromptContext(ctx, {
      feature: "shrink",
      saliencyMap: saliency,
    })

    expect(result.fullContext).toContain("SCENE SALIENCY")
  })

  it("omits saliency section when saliencyMap is null", () => {
    const ctx: StoryContext = {
      bible: { ...nullBible(), genre: "科幻" },
      characters: [],
    }
    const result = buildStoryPromptContext(ctx, {
      feature: "write",
      saliencyMap: null,
    })

    expect(result.fullContext).not.toContain("SCENE SALIENCY")
  })

  it("omits saliency section when saliencyMap is undefined", () => {
    const ctx: StoryContext = {
      bible: { ...nullBible(), genre: "科幻" },
      characters: [],
    }
    const result = buildStoryPromptContext(ctx, { feature: "write" })

    expect(result.fullContext).not.toContain("SCENE SALIENCY")
  })

  it("handles partial saliency (only characters)", () => {
    const partial: SaliencyMap = {
      activeCharacters: ["阿青"],
      activeLocations: [],
      activePlotlines: [],
    }
    const ctx: StoryContext = { bible: nullBible(), characters: [] }
    const result = buildStoryPromptContext(ctx, {
      feature: "write",
      saliencyMap: partial,
    })

    expect(result.fullContext).toContain("Active characters in scene: 阿青")
    expect(result.fullContext).not.toContain("Active locations")
    expect(result.fullContext).not.toContain("Active plotlines")
  })

  it("handles empty saliency (all arrays empty)", () => {
    const empty: SaliencyMap = {
      activeCharacters: [],
      activeLocations: [],
      activePlotlines: [],
    }
    const ctx: StoryContext = { bible: nullBible(), characters: [] }
    const result = buildStoryPromptContext(ctx, {
      feature: "write",
      saliencyMap: empty,
    })

    expect(result.fullContext).not.toContain("SCENE SALIENCY")
  })
})

// ---------------------------------------------------------------------------
// Prose mode override
// ---------------------------------------------------------------------------

describe("prose mode override in buildStoryPromptContext", () => {
  it("uses proseMode override instead of bible.prose_mode", () => {
    const ctx: StoryContext = {
      bible: { ...nullBible(), prose_mode: "balanced" },
      characters: [],
    }
    const result = buildStoryPromptContext(ctx, {
      feature: "write",
      proseMode: "cinematic",
    })

    expect(result.fullContext).toContain("visual, momentum-driven")
    expect(result.fullContext).not.toContain("Keep prose balanced")
  })

  it("falls back to bible.prose_mode when proseMode is null", () => {
    const ctx: StoryContext = {
      bible: { ...nullBible(), prose_mode: "lyrical" },
      characters: [],
    }
    const result = buildStoryPromptContext(ctx, {
      feature: "write",
      proseMode: null,
    })

    expect(result.fullContext).toContain("expressive rhythm")
  })

  it("defaults to balanced when no prose mode set", () => {
    const ctx: StoryContext = {
      bible: { ...nullBible() },
      characters: [],
    }
    const result = buildStoryPromptContext(ctx, { feature: "write" })

    expect(result.fullContext).toContain("Keep prose balanced")
  })

  it("includes style sample for match-style mode", () => {
    const ctx: StoryContext = {
      bible: {
        ...nullBible(),
        prose_mode: "match-style",
        style_sample: "夜幕低垂，星辰点缀着天际",
      },
      characters: [],
    }
    const result = buildStoryPromptContext(ctx, { feature: "rewrite" })

    expect(result.fullContext).toContain("Mimic the user style sample")
    expect(result.fullContext).toContain("夜幕低垂")
  })
})

// ---------------------------------------------------------------------------
// Feature-aware context building
// ---------------------------------------------------------------------------

describe("feature-aware context in buildStoryPromptContext", () => {
  const fullBible = {
    ...nullBible(),
    genre: "奇幻",
    style: "抒情",
    synopsis: "一个关于魔法的故事",
    themes: "勇气与牺牲",
    setting: "边陲王国",
    pov: "第三人称",
    tense: "过去式",
    worldbuilding: "魔法需要付出代价",
  }

  it("write feature includes setting with sensory detail instruction", () => {
    const ctx: StoryContext = { bible: fullBible, characters: [] }
    const result = buildStoryPromptContext(ctx, { feature: "write" })

    expect(result.fullContext).toContain("SETTING: 边陲王国")
    expect(result.fullContext).toContain("sensory details")
  })

  it("expand feature includes setting with sensory detail instruction", () => {
    const ctx: StoryContext = { bible: fullBible, characters: [] }
    const result = buildStoryPromptContext(ctx, { feature: "expand" })

    expect(result.fullContext).toContain("sensory details")
  })

  it("write feature includes themes with subtlety instruction", () => {
    const ctx: StoryContext = { bible: fullBible, characters: [] }
    const result = buildStoryPromptContext(ctx, { feature: "write" })

    expect(result.fullContext).toContain("THEMES TO WEAVE")
    expect(result.fullContext).toContain("never state them explicitly")
  })

  it("write feature includes strict writing params for POV and tense", () => {
    const ctx: StoryContext = { bible: fullBible, characters: [] }
    const result = buildStoryPromptContext(ctx, { feature: "rewrite" })

    expect(result.fullContext).toContain("STRICT WRITING PARAMETERS")
    expect(result.fullContext).toContain("第三人称")
    expect(result.fullContext).toContain("过去式")
  })

  it("shrink feature includes worldbuilding constraints", () => {
    const ctx: StoryContext = { bible: fullBible, characters: [] }
    const result = buildStoryPromptContext(ctx, { feature: "shrink" })

    expect(result.fullContext).toContain("WORLD RULES")
    expect(result.fullContext).toContain("魔法需要付出代价")
  })

  it("ai_rules have highest priority placement", () => {
    const ctx: StoryContext = {
      bible: { ...fullBible, ai_rules: "角色称呼必须使用全名" },
      characters: [],
    }
    const result = buildStoryPromptContext(ctx, { feature: "write" })

    expect(result.fullContext).toContain("AUTHOR'S RULES")
    expect(result.fullContext).toContain("角色称呼必须使用全名")
    // AI rules should appear before other sections
    const rulesPos = result.fullContext.indexOf("AUTHOR'S RULES")
    const genrePos = result.fullContext.indexOf("奇幻")
    expect(rulesPos).toBeLessThan(genrePos)
  })
})

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

describe("error classification", () => {
  it("classifies 401 as auth error", async () => {
    const { classifyAIError } = await import("./error-classification")
    const result = classifyAIError(401, null, "ai-stream")
    expect(result.errorType).toBe("auth")
    expect(result.retriable).toBe(false)
  })

  it("classifies 429 as rate limit", async () => {
    const { classifyAIError } = await import("./error-classification")
    const result = classifyAIError(429, null, "ai-stream")
    expect(result.errorType).toBe("rate_limit")
    expect(result.retriable).toBe(true)
  })

  it("classifies 500+ as server error", async () => {
    const { classifyAIError } = await import("./error-classification")
    const result = classifyAIError(502, null, "ai-stream")
    expect(result.errorType).toBe("server_error")
    expect(result.retriable).toBe(true)
    expect(result.suggestedActions).toContain("retry")
    expect(result.suggestedActions).toContain("switch_model")
  })

  it("classifies timeout error from runtime", async () => {
    const { classifyAIError } = await import("./error-classification")
    const result = classifyAIError(null, new Error("request timeout"), "ai-stream")
    expect(result.errorType).toBe("timeout")
    expect(result.retriable).toBe(true)
  })

  it("classifies connection refused", async () => {
    const { classifyAIError } = await import("./error-classification")
    const result = classifyAIError(null, new Error("ECONNREFUSED"), "ai-stream")
    expect(result.errorType).toBe("provider_unavailable")
  })
})

// ---------------------------------------------------------------------------
// Read AI stream
// ---------------------------------------------------------------------------

describe("readAIStream", () => {
  it("accumulates chunks and calls onChunk with full text", async () => {
    const { readAIStream } = await import("./read-ai-stream")

    const chunks = [
      new TextEncoder().encode("你好"),
      new TextEncoder().encode("世界"),
    ]
    let chunkIndex = 0
    const mockReader = {
      read: async () => {
        if (chunkIndex < chunks.length) {
          return { done: false, value: chunks[chunkIndex++] }
        }
        return { done: true, value: undefined }
      },
    } as ReadableStreamDefaultReader<Uint8Array>

    const received: string[] = []
    const result = await readAIStream(mockReader, (text) => received.push(text))

    expect(result).toBe("你好世界")
    expect(received).toEqual(["你好", "你好世界"])
  })

  it("handles empty stream", async () => {
    const { readAIStream } = await import("./read-ai-stream")

    const mockReader = {
      read: async () => ({ done: true, value: undefined }),
    } as ReadableStreamDefaultReader<Uint8Array>

    const received: string[] = []
    const result = await readAIStream(mockReader, (text) => received.push(text))

    expect(result).toBe("")
    expect(received).toEqual([])
  })

  it("calls onFirstChunk exactly once", async () => {
    const { readAIStream } = await import("./read-ai-stream")

    const chunks = [
      new TextEncoder().encode("A"),
      new TextEncoder().encode("B"),
      new TextEncoder().encode("C"),
    ]
    let chunkIndex = 0
    const mockReader = {
      read: async () => {
        if (chunkIndex < chunks.length) {
          return { done: false, value: chunks[chunkIndex++] }
        }
        return { done: true, value: undefined }
      },
    } as ReadableStreamDefaultReader<Uint8Array>

    let firstChunkCalls = 0
    const result = await readAIStream(
      mockReader,
      () => undefined,
      { onFirstChunk: () => { firstChunkCalls += 1 } }
    )

    expect(result).toBe("ABC")
    expect(firstChunkCalls).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Resolve config
// ---------------------------------------------------------------------------

describe("resolveAIConfig", () => {
  it("returns null when base URL is missing", async () => {
    const { resolveAIConfig } = await import("./resolve-config")
    const headers = new Headers()
    headers.set("X-AI-Model-ID", "deepseek-chat")
    const request = { headers } as unknown as import("next/server").NextRequest
    expect(resolveAIConfig(request)).toBeNull()
  })

  it("returns null when model ID is missing", async () => {
    const { resolveAIConfig } = await import("./resolve-config")
    const headers = new Headers()
    headers.set("X-AI-Base-URL", "https://api.deepseek.com/v1")
    const request = { headers } as unknown as import("next/server").NextRequest
    expect(resolveAIConfig(request)).toBeNull()
  })

  it("returns config when all required headers are present", async () => {
    const { resolveAIConfig } = await import("./resolve-config")
    const headers = new Headers()
    headers.set("X-AI-Base-URL", "https://api.deepseek.com/v1")
    headers.set("X-AI-API-Key", "sk-test")
    headers.set("X-AI-Model-ID", "deepseek-chat")
    const request = { headers } as unknown as import("next/server").NextRequest
    const config = resolveAIConfig(request)
    expect(config).not.toBeNull()
    expect(config!.baseUrl).toBe("https://api.deepseek.com/v1")
    expect(config!.apiKey).toBe("sk-test")
    expect(config!.modelId).toBe("deepseek-chat")
  })

  it("returns null for invalid URL", async () => {
    const { resolveAIConfig } = await import("./resolve-config")
    const headers = new Headers()
    headers.set("X-AI-Base-URL", "not-a-valid-url")
    headers.set("X-AI-Model-ID", "deepseek-chat")
    const request = { headers } as unknown as import("next/server").NextRequest
    expect(resolveAIConfig(request)).toBeNull()
  })

  it("allows empty API key (e.g. Ollama)", async () => {
    const { resolveAIConfig } = await import("./resolve-config")
    const headers = new Headers()
    headers.set("X-AI-Base-URL", "http://localhost:11434/v1")
    headers.set("X-AI-Model-ID", "llama3")
    const request = { headers } as unknown as import("next/server").NextRequest
    const config = resolveAIConfig(request)
    expect(config).not.toBeNull()
    expect(config!.apiKey).toBe("")
  })
})

// ---------------------------------------------------------------------------
// Prose mode
// ---------------------------------------------------------------------------

describe("buildProseModeGuidance", () => {
  it("returns empty string for null bible", async () => {
    const { buildProseModeGuidance } = await import("./prose-mode")
    expect(buildProseModeGuidance(null)).toBe("")
  })

  it("returns balanced mode by default", async () => {
    const { buildProseModeGuidance } = await import("./prose-mode")
    const result = buildProseModeGuidance({ prose_mode: null })
    expect(result).toContain("balanced")
  })

  it("returns specified mode guidance", async () => {
    const { buildProseModeGuidance } = await import("./prose-mode")
    const result = buildProseModeGuidance({ prose_mode: "minimal" })
    expect(result).toContain("concise, precise")
  })

  it("includes style intent when style is set", async () => {
    const { buildProseModeGuidance } = await import("./prose-mode")
    const result = buildProseModeGuidance({ prose_mode: "cinematic", style: "黑色电影" })
    expect(result).toContain("Style intent: 黑色电影")
  })

  it("includes style sample for match-style", async () => {
    const { buildProseModeGuidance } = await import("./prose-mode")
    const result = buildProseModeGuidance({
      prose_mode: "match-style",
      style_sample: "月光如水",
    })
    expect(result).toContain("Style sample")
    expect(result).toContain("月光如水")
  })

  it("does not include style sample for non-match-style modes", async () => {
    const { buildProseModeGuidance } = await import("./prose-mode")
    const result = buildProseModeGuidance({
      prose_mode: "lyrical",
      style_sample: "月光如水",
    })
    expect(result).not.toContain("Style sample")
    expect(result).not.toContain("月光如水")
  })
})

// ---------------------------------------------------------------------------
// Extract retry meta
// ---------------------------------------------------------------------------

describe("extractRetryMeta", () => {
  it("returns empty meta for clean request", async () => {
    const { extractRetryMeta } = await import("./openai-stream")
    const result = extractRetryMeta({ text: "hello" })
    expect(result).toEqual({})
  })

  it("extracts retry flag", async () => {
    const { extractRetryMeta } = await import("./openai-stream")
    const result = extractRetryMeta({ _isRetry: true, _recoveryType: "retry" })
    expect(result.isRetry).toBe(true)
    expect(result.recoveryType).toBe("retry")
  })

  it("extracts switch model info", async () => {
    const { extractRetryMeta } = await import("./openai-stream")
    const result = extractRetryMeta({
      _isRetry: true,
      _recoveryType: "switch",
      _attemptedModel: "gpt-4o",
    })
    expect(result.isRetry).toBe(true)
    expect(result.recoveryType).toBe("switch")
    expect(result.attemptedModel).toBe("gpt-4o")
  })
})
