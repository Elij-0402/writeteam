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

import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"

function makeSupabase(userId: string | null = "u-1") {
  const insert = vi.fn(async () => ({ error: null }))
  const from = vi.fn(() => ({ insert }))
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
    from,
  }
  return { client, insert, from }
}

function makeRequest(body: Record<string, unknown>) {
  return {
    json: vi.fn(async () => body),
    headers: new Headers(),
  } as unknown as Request
}

describe("continuity-check route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when user is not logged in", async () => {
    const { client } = makeSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({ projectId: "p-1", passage: "文本" }) as never)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "未登录" })
  })

  it("returns 400 when AI config is missing", async () => {
    const { client, insert } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue(null)

    const res = await POST(makeRequest({ projectId: "p-1", passage: "文本" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "AI 服务未配置，请先在设置中配置模型后重试" })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it("returns 400 when projectId is missing", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

    const res = await POST(makeRequest({ projectId: "", passage: "文本" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少项目ID，请返回项目后重试" })
  })

  it("returns 400 when passage is missing", async () => {
    const { client, insert } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

    const res = await POST(makeRequest({ projectId: "p-1", passage: "" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少待检查段落，请输入或选择文本后重试" })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it("returns 500 when stream helper throws", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
    vi.mocked(createOpenAIStreamResponse).mockRejectedValue(new Error("upstream failure") as never)

    const res = await POST(makeRequest({ projectId: "p-1", passage: "文本" }) as never)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({
      error: "连续性检查失败，请重试或切换模型后继续",
      errorType: "server_error",
      retriable: true,
      suggestedActions: ["retry", "switch_model"],
    })
  })

  it("passes structured prompt and telemetry fields on success", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "story ctx" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)

    const res = await POST(makeRequest({
      projectId: "p-1",
      documentId: "d-1",
      passage: "她昨晚在北城，但本段写成了南城。",
      context: "上一章提到她没有离开北城。",
    }) as never)

    expect(res.status).toBe(200)
    expect(createOpenAIStreamResponse).toHaveBeenCalled()

    const [payload, telemetry] = vi.mocked(createOpenAIStreamResponse).mock.calls[0] as [
      { messages: Array<{ role: string; content: string }> },
      { feature: string; projectId: string; documentId: string | null; promptLog: string }
    ]

    expect(payload.messages[0]?.content).toContain("仅输出 JSON")
    expect(payload.messages[1]?.content).toContain("issues")
    expect(telemetry.feature).toBe("continuity-check")
    expect(telemetry.projectId).toBe("p-1")
    expect(telemetry.documentId).toBe("d-1")
  })
})
