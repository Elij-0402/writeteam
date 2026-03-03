import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must come before importing the module under test
// ---------------------------------------------------------------------------

const mockLanguageModel = { modelId: "test-model", provider: "openai" }
const mockProviderInstance = vi.fn(() => mockLanguageModel)

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => mockProviderInstance),
}))

// ---------------------------------------------------------------------------
// Import SUT + mocked modules
// ---------------------------------------------------------------------------

import { createBYOKProvider, type BYOKConfig } from "./ai-provider"
import { createOpenAI } from "@ai-sdk/openai"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createBYOKProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("使用完整配置创建 provider", () => {
    const config: BYOKConfig = {
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-test-key",
      modelId: "deepseek-chat",
    }

    createBYOKProvider(config)

    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: "sk-test-key",
    })
  })

  it("apiKey 为空时传 undefined（Ollama 场景）", () => {
    const config: BYOKConfig = {
      baseUrl: "http://localhost:11434/v1",
      apiKey: "",
      modelId: "llama3",
    }

    createBYOKProvider(config)

    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: "http://localhost:11434/v1",
      apiKey: undefined,
    })
  })

  it("返回正确的 model 实例", () => {
    const config: BYOKConfig = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-openai",
      modelId: "gpt-4o",
    }

    const model = createBYOKProvider(config)

    expect(mockProviderInstance).toHaveBeenCalledWith("gpt-4o")
    expect(model).toBe(mockLanguageModel)
  })
})
