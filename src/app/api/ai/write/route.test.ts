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

function makeRequest(body: Record<string, unknown>) {
  return {
    json: vi.fn(async () => body),
    headers: new Headers(),
  } as unknown as Request
}

describe("write route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(runConsistencyPreflight).mockReturnValue({
      shouldBlock: false,
      highestSeverity: null,
      violations: [],
      softFailed: false,
    })
  })

  it("returns 401 when user is not logged in", async () => {
    const { client } = makeSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({ context: "上下文", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "未登录" })
  })

  it("returns 400 when AI config is missing", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue(null)

    const res = await POST(makeRequest({ context: "上下文", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "AI 服务未配置" })
  })

  it("returns 409 when preflight finds high-severity conflict", async () => {
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
          category: "required",
          message: "检测到必须项缺失：第一人称",
          rule: "必须保持第一人称",
        },
      ],
    })

    const res = await POST(makeRequest({ context: "他推门而入", mode: "auto", projectId: "p-1" }) as never)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toBe("检测到高风险设定冲突，请先修正后再试")
    expect(createOpenAIStreamResponse).not.toHaveBeenCalled()
  })

  it("streams response when preflight passes", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({ baseUrl: "https://x", modelId: "m", apiKey: "k" })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)

    const res = await POST(makeRequest({
      context: "上一段文本",
      mode: "guided",
      guidance: "让气氛更紧张",
      projectId: "p-1",
      documentId: "d-1",
    }) as never)

    expect(res.status).toBe(200)
    expect(createOpenAIStreamResponse).toHaveBeenCalled()
  })
})
