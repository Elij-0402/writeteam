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

vi.mock("@/lib/ai/telemetry", () => ({
  createTextFingerprint: vi.fn(() => "fp-abc"),
  estimateTokenCount: vi.fn(() => 100),
}))

vi.mock("@/lib/ai/consistency-preflight", () => ({
  runConsistencyPreflight: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { callOpenAIJson } from "@/lib/ai/openai-json"
import { runConsistencyPreflight } from "@/lib/ai/consistency-preflight"

function makeSupabase(userId: string | null = "u-1") {
  const insertFn = vi.fn(async () => ({ error: null }))
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
    from: vi.fn(() => ({ insert: insertFn })),
  }
  return { client, insertFn }
}

function makeRequest(body: Record<string, unknown>, options?: { rejectJson?: boolean }) {
  const jsonFn = options?.rejectJson
    ? () => Promise.reject(new Error("invalid json"))
    : () => Promise.resolve(body)

  const req = {
    json: vi.fn(jsonFn),
    headers: new Headers(),
    clone() {
      return makeRequest(body, options)
    },
  }
  return req as unknown as Request
}

describe("plan route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(runConsistencyPreflight).mockReturnValue({
      shouldBlock: false,
      highestSeverity: null,
      violations: [],
      softFailed: false,
    })
  })

  // -----------------------------------------------------------------------
  // Scene-plan intent (streaming, uses runStreamingPipeline)
  // -----------------------------------------------------------------------

  describe("scene-plan intent", () => {
    it("returns 401 when user is not logged in", async () => {
      const { client } = makeSupabase(null)
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(makeRequest({
        intent: "scene-plan",
        goal: "角色发现秘密",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data).toEqual({ error: "未登录" })
    })

    it("returns 400 when AI config is missing", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue(null)

      const res = await POST(makeRequest({
        intent: "scene-plan",
        goal: "角色发现秘密",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain("AI 服务未配置")
    })

    it("streams response for scene-plan intent", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
      vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)

      const res = await POST(makeRequest({
        intent: "scene-plan",
        goal: "角色发现秘密",
        context: "前情提要...",
        projectId: "p-1",
        documentId: "d-1",
      }))

      expect(res.status).toBe(200)
      expect(createOpenAIStreamResponse).toHaveBeenCalled()
    })

    it("defaults to scene-plan when no intent is specified", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)

      await POST(makeRequest({
        goal: "角色发现秘密",
        projectId: "p-1",
      }))

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      expect(messages[0].content).toContain("逐场景的详细规划")
    })

    it("includes context in scene-plan user prompt", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)

      await POST(makeRequest({
        intent: "scene-plan",
        goal: "进入地下室",
        context: "他走到楼梯口",
        projectId: "p-1",
      }))

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      expect(messages[1].content).toContain("他走到楼梯口")
      expect(messages[1].content).toContain("进入地下室")
    })
  })

  // -----------------------------------------------------------------------
  // Canvas-generate intent (non-streaming JSON)
  // -----------------------------------------------------------------------

  describe("canvas-generate intent", () => {
    it("returns 401 when user is not logged in", async () => {
      const { client } = makeSupabase(null)
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "这是一个完整的大纲内容",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data).toEqual({ error: "未登录" })
    })

    it("returns 400 when outline is missing", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain("未提供大纲内容")
    })

    it("returns 400 when outline is too short", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "短",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain("大纲内容过短")
    })

    it("returns beats when AI generates valid JSON", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: JSON.stringify([
          { label: "开场", content: "角色出现在城市中", type: "beat" },
          { label: "冲突", content: "发现了一封神秘信件", type: "beat" },
        ]),
      })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "角色走进城市，发现一封信，开始了冒险旅程",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.beats).toHaveLength(2)
      expect(data.beats[0].label).toBe("开场")
      expect(callOpenAIJson).toHaveBeenCalled()
    })

    it("returns 500 when AI returns completely unparseable content", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(callOpenAIJson).mockResolvedValue({ content: "not valid json at all" })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "角色走进城市，发现一封信，开始了冒险旅程",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toContain("AI 返回格式错误")
    })

    it("parses JSON wrapped in markdown code fences", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: '```json\n[{"label":"开场","content":"角色出现","type":"beat"}]\n```',
      })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "角色走进城市，发现一封信，开始了冒险旅程",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.beats).toHaveLength(1)
      expect(data.beats[0].label).toBe("开场")
    })

    it("parses JSON wrapped in uppercase ```JSON fences", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: '```JSON\n[{"label":"开场","content":"角色出现","type":"beat"}]\n```',
      })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "角色走进城市，发现一封信，开始了冒险旅程",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.beats).toHaveLength(1)
    })

    it("parses JSON wrapped in object like {beats: [...]}", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: JSON.stringify({
          beats: [
            { label: "开场", content: "角色出现", type: "beat" },
            { label: "冲突", content: "发现秘密", type: "beat" },
          ],
        }),
      })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "角色走进城市，发现一封信，开始了冒险旅程",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.beats).toHaveLength(2)
      expect(data.beats[0].label).toBe("开场")
    })

    it("parses JSON with leading/trailing explanatory text", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: '以下是生成的故事节拍：\n[{"label":"开场","content":"角色出现","type":"beat"}]\n希望对你有帮助！',
      })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "角色走进城市，发现一封信，开始了冒险旅程",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.beats).toHaveLength(1)
      expect(data.beats[0].label).toBe("开场")
    })

    it("parses JSON with trailing commas", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: '[{"label":"开场","content":"角色出现","type":"beat",},]',
      })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "角色走进城市，发现一封信，开始了冒险旅程",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.beats).toHaveLength(1)
    })

    it("parses object wrapped in code fences with explanatory text", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: '好的，以下是分析结果：\n```json\n{"story_beats":[{"label":"序幕","content":"故事开始","type":"beat"}]}\n```\n以上就是故事节拍。',
      })

      const res = await POST(makeRequest({
        intent: "canvas-generate",
        outline: "角色走进城市，发现一封信，开始了冒险旅程",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.beats).toHaveLength(1)
      expect(data.beats[0].label).toBe("序幕")
    })

    it("logs to ai_history on success", async () => {
      const { client, insertFn } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
      vi.mocked(callOpenAIJson).mockResolvedValue({
        content: JSON.stringify([
          { label: "开场", content: "角色出现", type: "beat" },
        ]),
      })

      await POST(makeRequest({
        intent: "canvas-generate",
        outline: "角色走进城市，发现一封信，开始了冒险旅程",
        projectId: "p-1",
      }))

      expect(client.from).toHaveBeenCalledWith("ai_history")
      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: "canvas-generate",
          user_id: "u-1",
          project_id: "p-1",
        }),
      )
    })
  })

  // -----------------------------------------------------------------------
  // Visualize intent (non-streaming, two-step)
  // -----------------------------------------------------------------------

  describe("visualize intent", () => {
    it("returns 401 when user is not logged in", async () => {
      const { client } = makeSupabase(null)
      vi.mocked(createClient).mockResolvedValue(client as never)

      const res = await POST(makeRequest({
        intent: "visualize",
        text: "一座古老的城堡",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data).toEqual({ error: "未登录" })
    })

    it("returns 400 when text is missing", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

      const res = await POST(makeRequest({
        intent: "visualize",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain("未提供描述文本")
    })

    it("returns 400 when API key is empty", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "" })

      const res = await POST(makeRequest({
        intent: "visualize",
        text: "一座古老的城堡",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain("图片生成需要 API Key")
    })

    it("returns 500 when prompt optimization fails", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(callOpenAIJson).mockResolvedValue({ content: "", error: "模型不可用" })

      const res = await POST(makeRequest({
        intent: "visualize",
        text: "一座古老的城堡",
        projectId: "p-1",
      }))
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toContain("Prompt 优化失败")
    })

    it("calls DALL-E API after prompt optimization", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://api.openai.com/v1", modelId: "m", apiKey: "k" })
      vi.mocked(callOpenAIJson).mockResolvedValue({ content: "A majestic ancient castle on a cliff" })

      // Mock global fetch for DALL-E call
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn(async (url) => {
        if (typeof url === "string" && url.includes("/images/generations")) {
          return new Response(JSON.stringify({
            data: [{ url: "https://dalle.example.com/image.png" }],
          }), { status: 200, headers: { "Content-Type": "application/json" } })
        }
        return originalFetch(url as string)
      }) as typeof fetch

      try {
        const res = await POST(makeRequest({
          intent: "visualize",
          text: "一座古老的城堡",
          style: "watercolor",
          projectId: "p-1",
        }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.imageUrl).toBe("https://dalle.example.com/image.png")
        expect(data.prompt).toBe("A majestic ancient castle on a cliff")
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})
