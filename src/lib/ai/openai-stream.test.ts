import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must come before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("ai", () => ({
  streamText: vi.fn(),
}))

vi.mock("@/lib/ai/ai-provider", () => ({
  createBYOKProvider: vi.fn(() => "mock-model"),
}))

vi.mock("@/lib/ai/telemetry", () => ({
  createTextFingerprint: vi.fn((text: string) => `fp-${text.slice(0, 8)}`),
  estimateTokenCount: vi.fn((text: string) => Math.ceil(text.length / 4)),
}))

vi.mock("@/lib/ai/error-classification", () => ({
  classifyAIError: vi.fn(() => ({
    errorType: "network",
    message: "网络异常，请检查网络连接并重试。",
    retriable: true,
    suggestedActions: ["retry", "check_config"],
    severity: "medium",
  })),
}))

vi.mock("@/lib/ai/ai-config", () => ({
  resolveProviderNameByBaseUrl: vi.fn(() => "DeepSeek"),
}))

// ---------------------------------------------------------------------------
// Import SUT + mocked modules
// ---------------------------------------------------------------------------

import { createOpenAIStreamResponse, extractRetryMeta } from "./openai-stream"
import { streamText } from "ai"
import { createBYOKProvider } from "@/lib/ai/ai-provider"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"
import { classifyAIError } from "@/lib/ai/error-classification"
import { resolveProviderNameByBaseUrl } from "@/lib/ai/ai-config"
import type { SupabaseClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockTextStream(chunks: string[]) {
  return {
    textStream: (async function* () {
      for (const chunk of chunks) yield chunk
    })(),
    usage: Promise.resolve({ promptTokens: 100, completionTokens: 50 }),
  }
}

function mockErrorTextStream(chunks: string[], error: Error) {
  return {
    textStream: (async function* () {
      for (const chunk of chunks) yield chunk
      throw error
    })(),
    usage: Promise.resolve({ promptTokens: 100, completionTokens: 50 }),
  }
}

const mockInsert = vi.fn(() => Promise.resolve({ error: null }))
const mockSupabase = {
  from: vi.fn(() => ({ insert: mockInsert })),
} as unknown as SupabaseClient

const defaultOptions = {
  messages: [
    { role: "system" as const, content: "You are a writing assistant." },
    { role: "user" as const, content: "Write a story." },
  ],
  maxTokens: 1000,
  temperature: 0.7,
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "test-key",
  modelId: "deepseek-chat",
}

const defaultTelemetry = {
  supabase: mockSupabase,
  userId: "user-123",
  projectId: "proj-456",
  documentId: "doc-789",
  feature: "write",
  promptLog: "[system] You are a writing assistant. | [user] Write a story.",
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractRetryMeta", () => {
  it("extracts retry metadata when all fields present", () => {
    const result = extractRetryMeta({
      _isRetry: true,
      _attemptedModel: "gpt-4",
      _recoveryType: "switch",
    })
    expect(result).toEqual({
      isRetry: true,
      attemptedModel: "gpt-4",
      recoveryType: "switch",
    })
  })

  it("returns empty object when no retry metadata present", () => {
    const result = extractRetryMeta({ text: "hello", projectId: "p1" })
    expect(result).toEqual({})
  })

  it("only extracts valid recoveryType values", () => {
    const result = extractRetryMeta({
      _isRetry: true,
      _recoveryType: "invalid",
    })
    expect(result).toEqual({ isRetry: true })
    expect(result.recoveryType).toBeUndefined()
  })
})

describe("createOpenAIStreamResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
  })

  it("calls createBYOKProvider with correct config", async () => {
    vi.mocked(streamText).mockReturnValue(mockTextStream(["hello"]) as ReturnType<typeof streamText>)

    await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)

    expect(createBYOKProvider).toHaveBeenCalledWith({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "test-key",
      modelId: "deepseek-chat",
    })
  })

  it("calls streamText with correct parameters", async () => {
    vi.mocked(streamText).mockReturnValue(mockTextStream(["hello"]) as ReturnType<typeof streamText>)

    await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)

    expect(streamText).toHaveBeenCalledWith({
      model: "mock-model",
      messages: defaultOptions.messages,
      maxOutputTokens: 1000,
      temperature: 0.7,
    })
  })

  it("returns streaming Response with correct content", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockTextStream(["Hello", " world", "!"]) as ReturnType<typeof streamText>,
    )

    const response = await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")

    const text = await response.text()
    expect(text).toBe("Hello world!")
  })

  it("writes success telemetry to ai_history", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockTextStream(["Hello", " world"]) as ReturnType<typeof streamText>,
    )

    const response = await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)
    // Consume the stream to trigger the finally block
    await response.text()

    expect(mockSupabase.from).toHaveBeenCalledWith("ai_history")
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        project_id: "proj-456",
        document_id: "doc-789",
        provider: "DeepSeek",
        feature: "write",
        prompt: defaultTelemetry.promptLog,
        result: "Hello world",
        model: "deepseek-chat",
        tokens_used: estimateTokenCount("Hello world"),
        output_chars: 11,
        response_fingerprint: createTextFingerprint("Hello world"),
        error_type: null,
        error_message: null,
        is_retry: false,
        recovery_status: "success",
        attempted_model: null,
      }),
    )
  })

  it("returns 502 error JSON when streamText throws", async () => {
    vi.mocked(streamText).mockImplementation(() => {
      throw new Error("Model not found")
    })

    const response = await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)

    expect(response.status).toBe(502)
    const json = await response.json()
    expect(json).toEqual({
      error: "网络异常，请检查网络连接并重试。",
      errorType: "network",
      retriable: true,
      suggestedActions: ["retry", "check_config"],
    })

    expect(classifyAIError).toHaveBeenCalledWith(null, expect.any(Error), "ai-stream")
  })

  it("writes failure telemetry when streamText throws", async () => {
    vi.mocked(streamText).mockImplementation(() => {
      throw new Error("Connection refused")
    })

    await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        result: "",
        output_chars: 0,
        error_type: "network",
        error_message: "网络异常，请检查网络连接并重试。",
        recovery_status: "failure",
      }),
    )
  })

  it("sends error event to stream when textStream iteration fails", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockErrorTextStream(["partial"], new Error("stream broken")) as ReturnType<typeof streamText>,
    )

    const response = await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)
    const text = await response.text()

    // Should contain the partial text plus the error event
    expect(text).toContain("partial")
    expect(text).toContain("data: ")
    expect(text).toContain("流式传输中断")
  })

  it("writes failure telemetry when stream is interrupted", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockErrorTextStream(["partial"], new Error("stream broken")) as ReturnType<typeof streamText>,
    )

    const response = await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)
    await response.text()

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "partial",
        error_type: "network",
        error_message: "流式传输中断",
        recovery_status: "failure",
      }),
    )
  })

  it("sets recovery_status to recovered_retry when isRetry is true", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockTextStream(["ok"]) as ReturnType<typeof streamText>,
    )

    const response = await createOpenAIStreamResponse(defaultOptions, {
      ...defaultTelemetry,
      isRetry: true,
    })
    await response.text()

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        recovery_status: "recovered_retry",
        is_retry: true,
      }),
    )
  })

  it("sets recovery_status to recovered_switch when recoveryType is switch", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockTextStream(["ok"]) as ReturnType<typeof streamText>,
    )

    const response = await createOpenAIStreamResponse(defaultOptions, {
      ...defaultTelemetry,
      isRetry: true,
      recoveryType: "switch",
    })
    await response.text()

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        recovery_status: "recovered_switch",
      }),
    )
  })

  it("resolves provider name from base URL for telemetry", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockTextStream(["hi"]) as ReturnType<typeof streamText>,
    )

    const response = await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)
    await response.text()

    expect(resolveProviderNameByBaseUrl).toHaveBeenCalledWith("https://api.deepseek.com/v1")
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "DeepSeek",
      }),
    )
  })

  it("sets response_fingerprint to null when output is empty", async () => {
    vi.mocked(streamText).mockReturnValue(
      mockTextStream([]) as ReturnType<typeof streamText>,
    )

    const response = await createOpenAIStreamResponse(defaultOptions, defaultTelemetry)
    await response.text()

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        response_fingerprint: null,
      }),
    )
  })
})
