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

vi.mock("@/lib/ai/consistency-preflight", () => ({
  runConsistencyPreflight: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { runConsistencyPreflight } from "@/lib/ai/consistency-preflight"

function makeSupabase(userId: string | null = "u-1") {
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
  }
  return { client }
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

function setupHappyPath() {
  const { client } = makeSupabase()
  vi.mocked(createClient).mockResolvedValue(client as never)
  vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
  vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
  vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
  vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)
}

describe("chat route (merged)", () => {
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
  // Shared pipeline validation
  // -----------------------------------------------------------------------

  it("returns 401 when user is not logged in", async () => {
    const { client } = makeSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "你好" }],
      projectId: "p-1",
    }) as never)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "未登录" })
  })

  it("returns 400 when AI config is missing", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue(null)

    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "你好" }],
      projectId: "p-1",
    }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("AI 服务未配置")
  })

  it("returns 400 when request body is malformed JSON", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({}, { rejectJson: true }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "请求参数格式错误，请刷新后重试" })
  })

  // -----------------------------------------------------------------------
  // chat intent (default)
  // -----------------------------------------------------------------------

  describe("chat intent", () => {
    it("returns 400 when messages are missing", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "缺少有效对话消息，请重新发送后重试" })
    })

    it("returns 400 when messages array is empty", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        messages: [],
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "缺少有效对话消息，请重新发送后重试" })
    })

    it("returns 400 when messages have invalid structure", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        messages: [{ role: "invalid", content: "hello" }],
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "缺少有效对话消息，请重新发送后重试" })
    })

    it("streams response with valid multi-turn messages", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        messages: [
          { role: "user", content: "你好" },
          { role: "assistant", content: "你好！有什么可以帮你的？" },
          { role: "user", content: "帮我发展角色" },
        ],
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)
      expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      // system + 3 user/assistant messages
      expect(messages).toHaveLength(4)
      expect(messages[0].role).toBe("system")
      expect(messages[0].content).toContain("creative AI writing assistant")
      expect(messages[1]).toEqual({ role: "user", content: "你好" })
      expect(messages[2]).toEqual({ role: "assistant", content: "你好！有什么可以帮你的？" })
      expect(messages[3]).toEqual({ role: "user", content: "帮我发展角色" })
    })

    it("includes document context in system prompt", async () => {
      setupHappyPath()

      await POST(makeRequest({
        messages: [{ role: "user", content: "分析一下" }],
        context: "这是当前文档内容",
        projectId: "p-1",
      }) as never)

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      expect(messages[0].content).toContain("这是当前文档内容")
    })

    it("defaults to chat intent when intent is not specified", async () => {
      setupHappyPath()
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "story-ctx" })

      await POST(makeRequest({
        messages: [{ role: "user", content: "你好" }],
        projectId: "p-1",
      }) as never)

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      expect(messages[0].content).toContain("creative AI writing assistant")
      expect(messages[0].content).toContain("story-ctx")
    })
  })

  // -----------------------------------------------------------------------
  // brainstorm intent
  // -----------------------------------------------------------------------

  describe("brainstorm intent", () => {
    it("returns 400 when topic is missing", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "brainstorm",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "缺少头脑风暴主题，请输入主题后重试" })
    })

    it("streams response with valid brainstorm request", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "brainstorm",
        topic: "角色动机",
        context: "主角是一个侦探",
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      expect(messages[0].content).toContain("creative brainstorming partner")
      expect(messages[1].content).toContain("角色动机")
      expect(messages[1].content).toContain("主角是一个侦探")
    })
  })

  // -----------------------------------------------------------------------
  // twist intent
  // -----------------------------------------------------------------------

  describe("twist intent", () => {
    it("returns 400 when context is missing", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "twist",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "缺少上下文文本，请提供当前段落后重试" })
    })

    it("streams response with valid twist request", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "twist",
        context: "侦探发现了一条重要线索",
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      expect(messages[0].content).toContain("创意写作顾问")
      expect(messages[1].content).toContain("侦探发现了一条重要线索")
    })
  })

  // -----------------------------------------------------------------------
  // muse intent
  // -----------------------------------------------------------------------

  describe("muse intent", () => {
    it("returns 400 when mode is missing", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "muse",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "无效的灵感模式" })
    })

    it("returns 400 when mode is invalid", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "muse",
        mode: "invalid-mode",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "无效的灵感模式" })
    })

    it("streams response for what-if mode with input", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "muse",
        mode: "what-if",
        input: "如果反派其实是主角的兄弟",
        context: "最近的故事文本",
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      expect(messages[0].content).toContain("what if")
      expect(messages[1].content).toContain("如果反派其实是主角的兄弟")
    })

    it("streams response for random-prompt mode", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "muse",
        mode: "random-prompt",
        context: "奇幻世界的冒险故事",
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      expect(messages[0].content).toContain("writing prompts")
      expect(messages[1].content).toContain("奇幻世界的冒险故事")
    })

    it("streams response for suggest mode", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "muse",
        mode: "suggest",
        context: "主角站在十字路口",
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)

      const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      const messages = call[0].messages as Array<{ role: string; content: string }>
      expect(messages[0].content).toContain("story analyst")
      expect(messages[1].content).toContain("主角站在十字路口")
    })
  })

  // -----------------------------------------------------------------------
  // bible-assist intent
  // -----------------------------------------------------------------------

  describe("bible-assist intent", () => {
    it("returns 400 when mode is missing", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "缺少必要参数或模式无效 (mode)" })
    })

    it("returns 400 when mode is invalid", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "unknown-mode",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "缺少必要参数或模式无效 (mode)" })
    })

    it("returns 400 for field-generate without targetField", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "field-generate",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "field-generate 需要 targetField" })
    })

    it("returns 400 for braindump-expand with empty braindump", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "braindump-expand",
        currentBible: { braindump: "" },
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "灵感池内容为空" })
    })

    it("returns 400 for document-extract without documentTexts", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "document-extract",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data).toEqual({ error: "没有可分析的文档内容" })
    })

    it("streams response for field-generate with valid params", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "field-generate",
        targetField: "genre",
        currentBible: { synopsis: "一个都市悬疑故事" },
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)
      expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)

      const callArgs = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
      expect(callArgs[1].feature).toBe("bible-assist-field-generate")
      expect(callArgs[0].maxTokens).toBe(2000)
      expect(callArgs[0].temperature).toBe(0.7)
    })

    it("streams response for braindump-expand with valid braindump", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "braindump-expand",
        currentBible: {
          braindump: "一个关于上海滩的故事，主角是一个侦探",
        },
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)
      expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)
      expect(
        vi.mocked(createOpenAIStreamResponse).mock.calls[0][1].feature
      ).toBe("bible-assist-braindump-expand")
    })

    it("streams response for character-generate", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "character-generate",
        currentBible: { synopsis: "一个奇幻冒险故事" },
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)
      expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)
      expect(
        vi.mocked(createOpenAIStreamResponse).mock.calls[0][1].feature
      ).toBe("bible-assist-character-generate")
    })

    it("streams response for document-extract with valid texts", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "document-extract",
        documentTexts: ["张三走进了黑暗的巷子", "李四在窗边等待"],
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)
      expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)
      expect(
        vi.mocked(createOpenAIStreamResponse).mock.calls[0][1].feature
      ).toBe("bible-assist-document-extract")
    })

    it("uses fallback field prompt for unknown targetField", async () => {
      setupHappyPath()

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "field-generate",
        targetField: "custom_field",
        projectId: "p-1",
      }) as never)

      expect(res.status).toBe(200)
      const userMsg =
        vi.mocked(createOpenAIStreamResponse).mock.calls[0][0].messages[1]
          .content
      expect(userMsg).toContain("custom_field")
    })

    it("returns 500 when story context fetch fails", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockRejectedValue(
        new Error("db failure") as never
      )

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "field-generate",
        targetField: "genre",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe("上下文加载失败，请重试或切换模型后继续")
      expect(data.retriable).toBe(true)
    })

    it("returns 500 when stream helper rejects", async () => {
      const { client } = makeSupabase()
      vi.mocked(createClient).mockResolvedValue(client as never)
      vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
      vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
      vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
      vi.mocked(createOpenAIStreamResponse).mockRejectedValue(
        new Error("upstream failure") as never
      )

      const res = await POST(makeRequest({
        intent: "bible-assist",
        mode: "field-generate",
        targetField: "genre",
        projectId: "p-1",
      }) as never)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe("AI 生成失败，请重试或切换模型后继续")
    })
  })

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it("returns 500 when stream helper rejects (non-bible-assist)", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
    vi.mocked(createOpenAIStreamResponse).mockRejectedValue(new Error("upstream failure") as never)

    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "你好" }],
      projectId: "p-1",
    }) as never)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({ error: "服务器内部错误" })
  })
})
