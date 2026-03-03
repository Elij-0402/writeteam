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

describe("edit route", () => {
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
  // Shared pipeline validation (delegated to runStreamingPipeline)
  // -----------------------------------------------------------------------

  it("returns 401 when user is not logged in", async () => {
    const { client } = makeSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({ text: "x", instruction: "y", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "未登录" })
  })

  it("returns 400 when AI config is missing", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue(null)

    const res = await POST(makeRequest({ text: "x", instruction: "y", projectId: "p-1" }) as never)
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

  it("returns 400 when projectId is missing", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

    const res = await POST(makeRequest({ text: "x", instruction: "y", projectId: "" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少项目ID，请返回项目后重试" })
  })

  it("returns 500 when stream helper rejects", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
    vi.mocked(createOpenAIStreamResponse).mockRejectedValue(new Error("upstream failure") as never)

    const res = await POST(makeRequest({ text: "原文", instruction: "改写", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({ error: "服务器内部错误" })
  })

  it("returns 409 when preflight finds high-severity conflict (quick-edit)", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [], consistencyState: undefined })
    vi.mocked(runConsistencyPreflight).mockReturnValue({
      shouldBlock: true,
      highestSeverity: "high",
      softFailed: false,
      violations: [
        {
          severity: "high",
          category: "forbidden",
          message: "检测到禁止项冲突：传送术",
          rule: "禁止使用传送术",
        },
      ],
    })

    const res = await POST(makeRequest({ text: "原文", instruction: "改写", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toBe("检测到高风险设定冲突，请先修正后再试")
    expect(createOpenAIStreamResponse).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // quick-edit intent (default)
  // -----------------------------------------------------------------------

  it("defaults to quick-edit intent when no intent is specified", async () => {
    setupHappyPath()

    await POST(makeRequest({
      text: "原文",
      instruction: "改得更紧张",
      context: "上下文",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[0].content).toContain("edit the selected text according to the author's natural language instruction")
    expect(messages[1].content).toContain("原文")
    expect(messages[1].content).toContain("改得更紧张")
  })

  it("includes surrounding context in quick-edit user prompt", async () => {
    setupHappyPath()

    await POST(makeRequest({
      intent: "quick-edit",
      text: "他打开了门",
      instruction: "加入内心独白",
      context: "这是上下文内容",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[1].content).toContain("他打开了门")
    expect(messages[1].content).toContain("加入内心独白")
    expect(messages[1].content).toContain("这是上下文内容")
  })

  // -----------------------------------------------------------------------
  // rewrite intent
  // -----------------------------------------------------------------------

  it("routes to rewrite intent with rephrase mode", async () => {
    setupHappyPath()

    await POST(makeRequest({
      intent: "rewrite",
      text: "他走进房间",
      mode: "rephrase",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[0].content).toContain("skilled fiction editor")
    expect(messages[1].content).toContain("Rephrase this passage")
    expect(messages[1].content).toContain("他走进房间")
  })

  it("routes to rewrite intent with show-not-tell mode", async () => {
    setupHappyPath()

    await POST(makeRequest({
      intent: "rewrite",
      text: "她很伤心",
      mode: "show-not-tell",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[1].content).toContain("show, don't tell")
  })

  it("routes to rewrite intent with custom mode and instructions", async () => {
    setupHappyPath()

    await POST(makeRequest({
      intent: "rewrite",
      text: "原始文本",
      mode: "custom",
      customInstructions: "用第一人称重写",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[1].content).toContain("用第一人称重写")
  })

  it("defaults to rephrase when rewrite mode is unrecognized", async () => {
    setupHappyPath()

    await POST(makeRequest({
      intent: "rewrite",
      text: "一些文本",
      mode: "unknown-mode",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[1].content).toContain("Rephrase this passage")
  })

  // -----------------------------------------------------------------------
  // shrink intent
  // -----------------------------------------------------------------------

  it("routes to shrink intent", async () => {
    setupHappyPath()

    await POST(makeRequest({
      intent: "shrink",
      text: "这是一段很长的文本，需要被精简到大约百分之五十的长度",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[0].content).toContain("Condense the given text to approximately 50%")
    expect(messages[1].content).toContain("这是一段很长的文本")
  })

  // -----------------------------------------------------------------------
  // tone-shift intent
  // -----------------------------------------------------------------------

  it("routes to tone-shift intent with known tone", async () => {
    setupHappyPath()

    await POST(makeRequest({
      intent: "tone-shift",
      text: "他走在路上",
      tone: "tense",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[0].content).toContain("紧张")
    expect(messages[1].content).toContain("紧张")
    expect(messages[1].content).toContain("他走在路上")
  })

  it("routes to tone-shift intent with melancholic tone", async () => {
    setupHappyPath()

    await POST(makeRequest({
      intent: "tone-shift",
      text: "阳光明媚",
      tone: "melancholic",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[0].content).toContain("悲伤")
    expect(messages[1].content).toContain("悲伤")
  })

  it("uses raw tone string when tone is not in TONE_LABELS", async () => {
    setupHappyPath()

    await POST(makeRequest({
      intent: "tone-shift",
      text: "文本内容",
      tone: "custom-tone",
      projectId: "p-1",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[0].content).toContain("custom-tone")
    expect(messages[1].content).toContain("custom-tone")
  })

  // -----------------------------------------------------------------------
  // Story context integration
  // -----------------------------------------------------------------------

  it("appends fullContext to system prompt when available", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "世界观：古代仙侠" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)

    await POST(makeRequest({
      intent: "shrink",
      text: "一段文本",
      projectId: "p-1",
      proseMode: "cinematic",
    }) as never)

    const call = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    const messages = call[0].messages as Array<{ role: string; content: string }>
    expect(messages[0].content).toContain("世界观：古代仙侠")
  })
})
