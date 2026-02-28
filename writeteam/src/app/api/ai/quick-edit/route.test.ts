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
import { buildStoryPromptContext, fetchStoryContext } from "@/lib/ai/story-context"
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

describe("quick-edit route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when user is not logged in", async () => {
    const { client, from } = makeSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({ text: "x", instruction: "y", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "未登录" })
    expect(from).not.toHaveBeenCalled()
  })

  it("returns 400 with actionable message when AI config is missing", async () => {
    const { client, insert } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue(null)

    const res = await POST(makeRequest({ text: "x", instruction: "y", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "AI 服务未配置，请先在设置中配置模型后重试" })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it("returns 400 when text is missing", async () => {
    const { client, insert } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

    const res = await POST(makeRequest({ text: "", instruction: "y", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少选中文本，请重新选择文本后重试" })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it("returns 400 when instruction is missing", async () => {
    const { client, insert } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

    const res = await POST(makeRequest({ text: "x", instruction: "", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少编辑指令，请输入编辑指令后重试" })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it("returns 400 when projectId is missing", async () => {
    const { client, insert } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })

    const res = await POST(makeRequest({ text: "x", instruction: "y", projectId: "" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少项目ID，请返回项目后重试" })
    expect(insert).not.toHaveBeenCalled()
  })

  it("returns 500 when upstream stream helper throws", async () => {
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

  it("passes proseMode and saliency into story context builder and streams response", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)

    const saliency = { activeCharacters: ["林晚"], activeLocations: [], activePlotlines: [] }
    const res = await POST(makeRequest({
      text: "原文",
      instruction: "改得更紧张",
      context: "上下文",
      projectId: "p-1",
      documentId: "d-1",
      proseMode: "cinematic",
      saliency,
    }) as never)

    expect(res.status).toBe(200)
    expect(buildStoryPromptContext).toHaveBeenCalledWith(
      { bible: null, characters: [] },
      {
        feature: "quick-edit",
        proseMode: "cinematic",
        saliencyMap: saliency,
      }
    )
    expect(createOpenAIStreamResponse).toHaveBeenCalled()
  })
})
