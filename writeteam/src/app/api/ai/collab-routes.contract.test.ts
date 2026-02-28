import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST as brainstormPOST } from "@/app/api/ai/brainstorm/route"
import { POST as scenePlanPOST } from "@/app/api/ai/scene-plan/route"
import { POST as twistPOST } from "@/app/api/ai/twist/route"
import { POST as chatPOST } from "@/app/api/ai/chat/route"

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

describe("collab ai routes contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(resolveAIConfig).mockReturnValue({
      baseUrl: "https://x",
      modelId: "m",
      apiKey: "k",
    })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(new Response("ok") as never)
  })

  it("brainstorm forwards proseMode override into prompt context", async () => {
    const res = await brainstormPOST(
      makeRequest({
        topic: "宫廷阴谋",
        context: "最近剧情",
        projectId: "p-1",
        documentId: "d-1",
        proseMode: "cinematic",
      }) as never
    )

    expect(res.status).toBe(200)
    expect(buildStoryPromptContext).toHaveBeenCalledWith(
      { bible: null, characters: [] },
      { feature: "brainstorm", proseMode: "cinematic" }
    )
  })

  it("scene-plan rejects missing projectId", async () => {
    const res = await scenePlanPOST(
      makeRequest({ goal: "规划追逐戏", projectId: "" }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少项目ID，请返回项目后重试" })
  })

  it("twist rejects empty context", async () => {
    const res = await twistPOST(
      makeRequest({ context: "", projectId: "p-1" }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少上下文文本，请提供当前段落后重试" })
  })

  it("chat rejects invalid messages payload", async () => {
    const res = await chatPOST(
      makeRequest({
        projectId: "p-1",
        messages: [{ role: "system", content: "x" }],
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少有效对话消息，请重新发送后重试" })
  })

  it("chat keeps telemetry feature stable", async () => {
    const res = await chatPOST(
      makeRequest({
        projectId: "p-1",
        documentId: "d-1",
        context: "当前上下文",
        proseMode: "lyrical",
        messages: [{ role: "user", content: "给我三个转折" }],
      }) as never
    )

    expect(res.status).toBe(200)
    expect(createOpenAIStreamResponse).toHaveBeenCalled()
    const secondArg = vi.mocked(createOpenAIStreamResponse).mock.calls[0]?.[1]
    expect(secondArg).toMatchObject({
      feature: "chat",
      projectId: "p-1",
      documentId: "d-1",
    })
  })

  it("returns recoverable envelope when brainstorm context loading fails", async () => {
    vi.mocked(fetchStoryContext).mockRejectedValueOnce(new Error("ctx failed"))

    const res = await brainstormPOST(
      makeRequest({
        topic: "宫廷阴谋",
        context: "最近剧情",
        projectId: "p-1",
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({
      error: "上下文加载失败，请重试或切换模型后继续",
      errorType: "server_error",
      retriable: true,
      suggestedActions: ["retry", "switch_model"],
    })
  })

  it("returns recoverable envelope when scene-plan context loading fails", async () => {
    vi.mocked(fetchStoryContext).mockRejectedValueOnce(new Error("ctx failed"))

    const res = await scenePlanPOST(
      makeRequest({
        goal: "规划追逐戏",
        context: "最近剧情",
        projectId: "p-1",
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({
      error: "上下文加载失败，请重试或切换模型后继续",
      errorType: "server_error",
      retriable: true,
      suggestedActions: ["retry", "switch_model"],
    })
  })

  it("returns recoverable envelope when twist context loading fails", async () => {
    vi.mocked(fetchStoryContext).mockRejectedValueOnce(new Error("ctx failed"))

    const res = await twistPOST(
      makeRequest({
        context: "最近剧情",
        projectId: "p-1",
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({
      error: "上下文加载失败，请重试或切换模型后继续",
      errorType: "server_error",
      retriable: true,
      suggestedActions: ["retry", "switch_model"],
    })
  })

  it("returns recoverable envelope when chat context loading fails", async () => {
    vi.mocked(fetchStoryContext).mockRejectedValueOnce(new Error("ctx failed"))

    const res = await chatPOST(
      makeRequest({
        projectId: "p-1",
        messages: [{ role: "user", content: "给我三个转折" }],
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({
      error: "上下文加载失败，请重试或切换模型后继续",
      errorType: "server_error",
      retriable: true,
      suggestedActions: ["retry", "switch_model"],
    })
  })
})
