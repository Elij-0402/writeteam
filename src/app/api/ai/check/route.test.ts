import { beforeEach, describe, expect, it, vi } from "vitest"

import { POST } from "./route"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/ai/resolve-config", () => ({
  resolveAIConfig: vi.fn(),
}))

vi.mock("@/lib/ai/story-context", () => ({
  fetchStoryContext: vi.fn(),
  buildStoryPromptContext: vi.fn(),
}))

vi.mock("@/lib/ai/openai-stream", () => ({
  createOpenAIStreamResponse: vi.fn(),
  extractRetryMeta: vi.fn(() => ({})),
}))

vi.mock("@/lib/ai/openai-json", () => ({
  callOpenAIJson: vi.fn(),
}))

vi.mock("@/lib/ai/saliency", () => ({
  computeSaliency: vi.fn(),
}))

vi.mock("@/lib/ai/telemetry", () => ({
  createTextFingerprint: vi.fn(() => "fp-mock"),
  estimateTokenCount: vi.fn(() => 42),
}))

import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { callOpenAIJson } from "@/lib/ai/openai-json"
import { computeSaliency } from "@/lib/ai/saliency"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSupabase(userId: string | null = "u-1") {
  const insertFn = vi.fn(async () => ({ error: null }))

  // Feedback chain mocks
  const updateSelect = vi.fn(async () => ({ data: [{ id: "h-1" }], error: null }))
  const updateIs = vi.fn(() => ({ select: updateSelect }))
  const updateEqUser = vi.fn(() => ({ is: updateIs }))
  const updateEqId = vi.fn(() => ({ eq: updateEqUser }))
  const update = vi.fn(() => ({ eq: updateEqId }))

  const lookupLimit = vi.fn(async () => ({ data: [{ id: "h-1", user_rating: null }], error: null }))
  const lookupOrder = vi.fn(() => ({ limit: lookupLimit }))
  const lookupEqFingerprint = vi.fn(() => ({ order: lookupOrder }))
  const lookupEqFeature = vi.fn(() => ({ eq: lookupEqFingerprint }))
  const lookupEqProject = vi.fn(() => ({ eq: lookupEqFeature }))
  const lookupEqUser = vi.fn(() => ({ eq: lookupEqProject }))
  const lookupSelect = vi.fn(() => ({ eq: lookupEqUser }))

  const from = vi.fn((table: string) => {
    if (table === "ai_history") {
      return { insert: insertFn, update, select: lookupSelect }
    }
    return { insert: insertFn, update, select: lookupSelect }
  })

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
      })),
    },
    from,
  }

  return { client, from, update, lookupLimit, insertFn }
}

function makeRequest(body: Record<string, unknown>) {
  const req = {
    json: vi.fn(async () => body),
    headers: new Headers(),
    clone() {
      return makeRequest(body)
    },
  }
  return req as unknown as Request
}

function makeInvalidJsonRequest() {
  const req = {
    json: vi.fn(async () => {
      throw new Error("invalid json")
    }),
    headers: new Headers(),
    clone() {
      return makeInvalidJsonRequest()
    },
  }
  return req as unknown as Request
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("check route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // Top-level routing
  // -----------------------------------------------------------------------

  it("returns 400 when request body is not valid JSON", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeInvalidJsonRequest() as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "请求参数格式错误，请刷新后重试" })
  })

  it("defaults to continuity-check intent when no intent specified", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        documentId: "d-1",
        passage: "她昨夜仍在北城。",
        context: "上一章内容",
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)
  })

  // -----------------------------------------------------------------------
  // continuity-check intent
  // -----------------------------------------------------------------------

  describe("intent: continuity-check", () => {
    it("returns 401 when user is not logged in", async () => {
      const { client } = makeSupabase(null)
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(
        makeRequest({
          intent: "continuity-check",
          projectId: "p-1",
          passage: "text",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data).toEqual({ error: "未登录" })
    })

    it("returns 400 when AI config is missing", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue(null)

      const res = await POST(
        makeRequest({
          intent: "continuity-check",
          projectId: "p-1",
          passage: "text",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain("AI 服务未配置")
    })

    it("returns 400 when passage is missing", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

      const res = await POST(
        makeRequest({
          intent: "continuity-check",
          projectId: "p-1",
          passage: "",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain("缺少待检查段落")
    })

    it("requires stable evidence fields and deterministic action payload", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
      vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)

      const res = await POST(
        makeRequest({
          intent: "continuity-check",
          projectId: "p-1",
          documentId: "d-1",
          passage: "她昨夜仍在北城，本段却写成今晨已到南城。",
          context: "上一章明确她没有离开北城。",
        }) as never,
      )

      expect(res.status).toBe(200)
      expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)

      const firstArg = vi.mocked(createOpenAIStreamResponse).mock.calls[0]?.[0]
      const messages = firstArg?.messages ?? []
      const promptText = messages.map((item) => item.content).join("\n")

      expect(promptText).toContain("evidenceQuote")
      expect(promptText).toContain("evidenceAnchor")
      expect(promptText).toContain("action")
      expect(promptText).toContain("action.type")
      expect(promptText).toContain("action.target")
      expect(promptText).toContain("action.text")
      expect(promptText).toContain("actionType")
      expect(promptText).toContain("insertionText")
      expect(promptText).toContain("replacementText")
    })

    it("returns 500 when stream helper rejects", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
      vi.mocked(createOpenAIStreamResponse).mockRejectedValue(new Error("upstream failure") as never)

      const res = await POST(
        makeRequest({
          intent: "continuity-check",
          projectId: "p-1",
          passage: "test passage",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toContain("连续性检查失败")
      expect(data.retriable).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // saliency intent
  // -----------------------------------------------------------------------

  describe("intent: saliency", () => {
    it("returns 401 when user is not logged in", async () => {
      const { client } = makeSupabase(null)
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(
        makeRequest({
          intent: "saliency",
          text: "some text",
          projectId: "p-1",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data).toEqual({ error: "未登录" })
    })

    it("returns 400 when required params are missing", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(
        makeRequest({
          intent: "saliency",
          text: "",
          projectId: "",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "缺少必要参数" })
    })

    it("returns heuristic result when AI config is missing", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue(null)
      vi.mocked(fetchStoryContext).mockResolvedValue({
        bible: { setting: "古代" },
        characters: [{ name: "张三", role: "主角" }],
      })
      const heuristic = {
        activeCharacters: ["张三"],
        activeLocations: [],
        activePlotlines: [],
      }
      vi.mocked(computeSaliency).mockReturnValue(heuristic)

      const res = await POST(
        makeRequest({
          intent: "saliency",
          text: "张三走在路上",
          projectId: "p-1",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toEqual(heuristic)
      expect(callOpenAIJson).not.toHaveBeenCalled()
    })

    it("returns AI-enhanced result when AI call succeeds", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({
        bible: { setting: "古代" },
        characters: [{ name: "张三", role: "主角" }],
      })
      vi.mocked(computeSaliency).mockReturnValue({
        activeCharacters: ["张三"],
        activeLocations: [],
        activePlotlines: [],
      })
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: JSON.stringify({
          activeCharacters: ["张三", "李四"],
          activeLocations: ["北城"],
          activePlotlines: ["寻宝"],
        }),
      })

      const res = await POST(
        makeRequest({
          intent: "saliency",
          text: "张三和李四在北城寻宝",
          projectId: "p-1",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.activeCharacters).toEqual(["张三", "李四"])
      expect(data.activeLocations).toEqual(["北城"])
      expect(data.activePlotlines).toEqual(["寻宝"])
    })

    it("falls back to heuristic when AI returns an error", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({
        bible: null,
        characters: [{ name: "张三", role: "主角" }],
      })
      const heuristic = {
        activeCharacters: ["张三"],
        activeLocations: [],
        activePlotlines: [],
      }
      vi.mocked(computeSaliency).mockReturnValue(heuristic)
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: "",
        error: "AI API 错误: timeout",
      })

      const res = await POST(
        makeRequest({
          intent: "saliency",
          text: "张三",
          projectId: "p-1",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toEqual(heuristic)
    })

    it("falls back to heuristic when AI returns invalid JSON", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({
        bible: null,
        characters: [],
      })
      const heuristic = {
        activeCharacters: [],
        activeLocations: [],
        activePlotlines: [],
      }
      vi.mocked(computeSaliency).mockReturnValue(heuristic)
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: "not valid json {{",
      })

      const res = await POST(
        makeRequest({
          intent: "saliency",
          text: "some text",
          projectId: "p-1",
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toEqual(heuristic)
    })
  })

  // -----------------------------------------------------------------------
  // feedback intent
  // -----------------------------------------------------------------------

  describe("intent: feedback", () => {
    it("returns 401 when user is not logged in", async () => {
      const { client, from } = makeSupabase(null)
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(makeRequest({ intent: "feedback" }) as never)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "未登录",
        },
      })
      expect(from).not.toHaveBeenCalled()
    })

    it("returns 400 when payload is invalid", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(
        makeRequest({
          intent: "feedback",
          projectId: "",
          rating: 0,
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "反馈参数无效，仅支持 -1 或 1",
        },
      })
    })

    it("returns 404 when no matching AI response exists", async () => {
      const { client, lookupLimit } = makeSupabase()
      lookupLimit.mockResolvedValue({ data: [], error: null })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(
        makeRequest({
          intent: "feedback",
          projectId: "p-1",
          feature: "quick-edit",
          responseFingerprint: "fp-1",
          rating: 1,
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data).toEqual({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "未找到对应的 AI 响应",
        },
      })
    })

    it("returns 409 when duplicate feedback is submitted", async () => {
      const { client, lookupLimit } = makeSupabase()
      lookupLimit.mockResolvedValue({
        data: [{ id: "h-1", user_rating: 1 }],
        error: null,
      })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(
        makeRequest({
          intent: "feedback",
          projectId: "p-1",
          feature: "quick-edit",
          responseFingerprint: "fp-1",
          rating: -1,
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(409)
      expect(data).toEqual({
        success: false,
        error: {
          code: "ALREADY_RATED",
          message: "该 AI 响应已反馈过，不能重复提交",
        },
        existingRating: 1,
      })
    })

    it("returns 200 when feedback is written successfully", async () => {
      const { client, from, update } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(
        makeRequest({
          intent: "feedback",
          projectId: "p-1",
          feature: "quick-edit",
          responseFingerprint: "fp-1",
          rating: 1,
        }) as never,
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toEqual({ success: true })
      expect(from).toHaveBeenCalledTimes(2) // 1 for lookup, 1 for update
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          user_rating: 1,
        }),
      )
    })
  })
})
