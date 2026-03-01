import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/ai/resolve-config", () => ({
  resolveAIConfig: vi.fn(),
}))

vi.mock("@/lib/ai/openai-json", () => ({
  callOpenAIJson: vi.fn(),
}))

vi.mock("@/lib/ai/story-context", () => ({
  fetchStoryContext: vi.fn(),
  buildStoryPromptContext: vi.fn(),
}))

vi.mock("@/lib/ai/telemetry", () => ({
  createTextFingerprint: vi.fn(() => "fp"),
  estimateTokenCount: vi.fn(() => 123),
}))

import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { callOpenAIJson } from "@/lib/ai/openai-json"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { POST } from "./route"

function makeSupabase(userId: string | null = "u-1") {
  const insert = vi.fn(async () => ({ error: null }))
  const from = vi.fn(() => ({ insert }))
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
    from,
  }
  return { client, from, insert }
}

function makeRequest(body: Record<string, unknown>) {
  return {
    json: vi.fn(async () => body),
    headers: new Headers(),
  } as unknown as Request
}

function makeInvalidJsonRequest() {
  return {
    json: vi.fn(async () => {
      throw new Error("invalid json")
    }),
    headers: new Headers(),
  } as unknown as Request
}

describe("canvas-generate route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
  })

  it("returns 400 when projectId is missing", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({ projectId: "", outline: "这是一个足够长的大纲内容" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少项目ID，请返回项目后重试" })
  })

  it("returns 400 when outline is too short", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({ projectId: "p-1", outline: "太短" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "大纲内容过短，请补充更多剧情信息后重试" })
  })

  it("returns 400 when request body is invalid JSON", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeInvalidJsonRequest() as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "请求格式错误，请检查输入后重试" })
  })

  it("returns beats when AI response can be normalized", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(callOpenAIJson).mockResolvedValue({
      content: "```json\n[{\"label\":\"开场\",\"content\":\"主角收到神秘来信\",\"type\":\"invalid-type\"}]\n```",
    })

    const res = await POST(makeRequest({ projectId: "p-1", outline: "这是一个足够长的大纲内容，包含起承转合与人物冲突。" }) as never)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.beats).toHaveLength(1)
    expect(data.beats[0]).toEqual({
      label: "开场",
      content: "主角收到神秘来信",
      type: "beat",
    })
  })

  it("returns 500 with actionable error when AI response is invalid", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(callOpenAIJson).mockResolvedValue({ content: "{\"not\":\"array\"}" })

    const res = await POST(makeRequest({ projectId: "p-1", outline: "这是一个足够长的大纲内容，包含完整冲突与结局伏笔。" }) as never)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({ error: "AI 返回格式错误：结果不是数组" })
  })
})
