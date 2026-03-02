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

describe("continuity-check route contract", () => {
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

  it("requires stable evidence fields and deterministic action payload", async () => {
    const res = await POST(
      makeRequest({
        projectId: "p-1",
        documentId: "d-1",
        passage: "她昨夜仍在北城，本段却写成今晨已到南城。",
        context: "上一章明确她没有离开北城。",
      }) as never
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
})
