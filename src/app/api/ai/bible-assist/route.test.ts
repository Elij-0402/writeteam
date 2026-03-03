import { beforeEach, describe, expect, it, vi } from "vitest"

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
}))

import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import {
  fetchStoryContext,
  buildStoryPromptContext,
} from "@/lib/ai/story-context"
import { createOpenAIStreamResponse } from "@/lib/ai/openai-stream"
import { POST } from "./route"

function makeSupabase(userId: string | null = "u-1") {
  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
      })),
    },
  }
  return { client }
}

function makeRequest(
  body: Record<string, unknown>,
  options?: { rejectJson?: boolean }
) {
  return {
    json: options?.rejectJson
      ? vi.fn(async () => {
          throw new Error("invalid json")
        })
      : vi.fn(async () => body),
    headers: new Headers(),
  } as unknown as Request
}

describe("bible-assist route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveAIConfig).mockReturnValue({
      baseUrl: "https://x",
      modelId: "m",
      apiKey: "k",
    })
    vi.mocked(fetchStoryContext).mockResolvedValue({
      bible: null,
      characters: [],
    })
    vi.mocked(buildStoryPromptContext).mockReturnValue({
      fullContext: "ctx",
    })
  })

  it("returns 401 when user is not authenticated", async () => {
    const { client } = makeSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "field-generate",
        targetField: "genre",
      }) as never
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
        projectId: "p-1",
        mode: "field-generate",
        targetField: "genre",
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      error: "AI 服务未配置，请先在设置中配置模型后重试",
    })
  })

  it("returns 400 when request body is malformed JSON", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({}, { rejectJson: true }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "请求参数格式错误，请刷新后重试" })
  })

  it("returns 400 when mode is missing", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({ projectId: "p-1" }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少必要参数或模式无效 (mode)" })
  })

  it("returns 400 when mode is invalid", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({ projectId: "p-1", mode: "unknown-mode" }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "缺少必要参数或模式无效 (mode)" })
  })

  it("returns 400 when projectId is missing", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({ mode: "field-generate", targetField: "genre" }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      error: "缺少项目ID，请返回项目后重试",
    })
  })

  it("returns 400 for field-generate without targetField", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({ projectId: "p-1", mode: "field-generate" }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "field-generate 需要 targetField" })
  })

  it("returns 400 for braindump-expand with empty braindump", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "braindump-expand",
        currentBible: { braindump: "" },
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "灵感池内容为空" })
  })

  it("returns 400 for document-extract without documentTexts", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "document-extract",
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "没有可分析的文档内容" })
  })

  it("streams response for field-generate with valid params", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("ok") as never
    )

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "field-generate",
        targetField: "genre",
        currentBible: { synopsis: "一个都市悬疑故事" },
      }) as never
    )

    expect(res.status).toBe(200)
    expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)

    const callArgs = vi.mocked(createOpenAIStreamResponse).mock.calls[0]
    expect(callArgs[1].feature).toBe("bible-assist-field-generate")
    expect(callArgs[0].maxTokens).toBe(2000)
    expect(callArgs[0].temperature).toBe(0.7)
  })

  it("streams response for braindump-expand with valid braindump", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("ok") as never
    )

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "braindump-expand",
        currentBible: {
          braindump: "一个关于上海滩的故事，主角是一个侦探",
        },
      }) as never
    )

    expect(res.status).toBe(200)
    expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(createOpenAIStreamResponse).mock.calls[0][1].feature
    ).toBe("bible-assist-braindump-expand")
  })

  it("streams response for character-generate", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("ok") as never
    )

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "character-generate",
        currentBible: { synopsis: "一个奇幻冒险故事" },
      }) as never
    )

    expect(res.status).toBe(200)
    expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(createOpenAIStreamResponse).mock.calls[0][1].feature
    ).toBe("bible-assist-character-generate")
  })

  it("streams response for document-extract with valid texts", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("ok") as never
    )

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "document-extract",
        documentTexts: ["张三走进了黑暗的巷子", "李四在窗边等待"],
      }) as never
    )

    expect(res.status).toBe(200)
    expect(createOpenAIStreamResponse).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(createOpenAIStreamResponse).mock.calls[0][1].feature
    ).toBe("bible-assist-document-extract")
  })

  it("returns 500 when story context fetch fails", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(fetchStoryContext).mockRejectedValue(
      new Error("db failure") as never
    )

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "field-generate",
        targetField: "genre",
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe("上下文加载失败，请重试或切换模型后继续")
    expect(data.retriable).toBe(true)
  })

  it("returns 500 when stream helper rejects", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createOpenAIStreamResponse).mockRejectedValue(
      new Error("upstream failure") as never
    )

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "field-generate",
        targetField: "genre",
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe("AI 生成失败，请重试或切换模型后继续")
  })

  it("uses fallback field prompt for unknown targetField", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("ok") as never
    )

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        mode: "field-generate",
        targetField: "custom_field",
      }) as never
    )

    expect(res.status).toBe(200)
    const userMsg =
      vi.mocked(createOpenAIStreamResponse).mock.calls[0][0].messages[1]
        .content
    expect(userMsg).toContain("custom_field")
  })
})
