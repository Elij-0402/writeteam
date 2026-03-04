import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("ai", () => ({
  generateText: vi.fn(),
}))

vi.mock("@/lib/ai/ai-provider", () => ({
  createBYOKProvider: vi.fn(() => "mock-model"),
}))

import { callOpenAIJson } from "./openai-json"
import { generateText } from "ai"
import { createBYOKProvider } from "@/lib/ai/ai-provider"

describe("callOpenAIJson", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls generateText with correct parameters", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '{"result": "ok"}',
    } as Awaited<ReturnType<typeof generateText>>)

    const messages = [
      { role: "system" as const, content: "sys" },
      { role: "user" as const, content: "usr" },
    ]

    await callOpenAIJson({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
      messages,
      maxTokens: 500,
      temperature: 0.3,
    })

    expect(createBYOKProvider).toHaveBeenCalledWith({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
    })

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        messages,
        maxOutputTokens: 500,
        temperature: 0.3,
      }),
    )
  })

  it("returns content on success", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '{"activeCharacters": ["\u674e\u660e"]}',
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await callOpenAIJson({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "m1",
      messages: [{ role: "user", content: "test" }],
      maxTokens: 100,
      temperature: 0.3,
    })

    expect(result.content).toBe('{"activeCharacters": ["\u674e\u660e"]}')
    expect(result.error).toBeUndefined()
  })

  it("returns error when generateText throws", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("API error"))

    const result = await callOpenAIJson({
      baseUrl: "https://bad.url/v1",
      apiKey: "key",
      modelId: "m1",
      messages: [{ role: "user", content: "test" }],
      maxTokens: 100,
      temperature: 0.3,
    })

    expect(result.content).toBe("")
    expect(result.error).toContain("AI API \u9519\u8bef")
  })
})
