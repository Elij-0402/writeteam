import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must come before importing the module under test
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockSupabase = {
  auth: { getUser: mockGetUser },
} as unknown as import("@supabase/supabase-js").SupabaseClient

vi.mock("@/lib/ai/resolve-config", () => ({
  resolveAIConfig: vi.fn(),
}))

vi.mock("@/lib/ai/openai-stream", () => ({
  createOpenAIStreamResponse: vi.fn(),
  extractRetryMeta: vi.fn(() => ({})),
}))

vi.mock("@/lib/ai/story-context", () => ({
  fetchStoryContext: vi.fn(),
  buildStoryPromptContext: vi.fn(),
}))

vi.mock("@/lib/ai/consistency-preflight", () => ({
  runConsistencyPreflight: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import SUT + mocked modules
// ---------------------------------------------------------------------------

import { validateAndResolve, runStreamingPipeline } from "./shared-pipeline"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { createOpenAIStreamResponse, extractRetryMeta } from "@/lib/ai/openai-stream"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { runConsistencyPreflight } from "@/lib/ai/consistency-preflight"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/ai/write", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// validateAndResolve
// ---------------------------------------------------------------------------

describe("validateAndResolve", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const req = makeRequest({ projectId: "p1" })
    const result = await validateAndResolve(mockSupabase, req)

    expect(result.error).toBeDefined()
    expect(result.error!.status).toBe(401)
  })

  it("returns 400 when projectId is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })

    const req = makeRequest({})
    const result = await validateAndResolve(mockSupabase, req)

    expect(result.error).toBeDefined()
    expect(result.error!.status).toBe(400)
    const json = await result.error!.json()
    expect(json.error).toContain("项目")
  })

  it("returns 400 when projectId is an empty string", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })

    const req = makeRequest({ projectId: "  " })
    const result = await validateAndResolve(mockSupabase, req)

    expect(result.error).toBeDefined()
    expect(result.error!.status).toBe(400)
  })

  it("returns 400 when AI config is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    vi.mocked(resolveAIConfig).mockReturnValue(null)

    const req = makeRequest({ projectId: "p1" })
    const result = await validateAndResolve(mockSupabase, req)

    expect(result.error).toBeDefined()
    expect(result.error!.status).toBe(400)
    const json = await result.error!.json()
    expect(json.error).toContain("AI")
  })

  it("returns resolved data on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    const mockConfig = { baseUrl: "https://api.test.com/v1", apiKey: "key", modelId: "model-1" }
    vi.mocked(resolveAIConfig).mockReturnValue(mockConfig)

    const req = makeRequest({ projectId: "p1", extra: "data" })
    const result = await validateAndResolve(mockSupabase, req)

    expect(result.error).toBeUndefined()
    expect(result.userId).toBe("u1")
    expect(result.body).toEqual({ projectId: "p1", extra: "data" })
    expect(result.aiConfig).toEqual(mockConfig)
  })
})

// ---------------------------------------------------------------------------
// runStreamingPipeline
// ---------------------------------------------------------------------------

describe("runStreamingPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({ projectId: "p1" }),
      intent: "write",
      buildMessages: () => [],
    })

    expect(response.status).toBe(401)
  })

  it("returns 400 when projectId is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    vi.mocked(resolveAIConfig).mockReturnValue({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
    })

    const response = await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({}),
      intent: "write",
      buildMessages: () => [],
    })

    expect(response.status).toBe(400)
  })

  it("returns 400 when AI config is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    vi.mocked(resolveAIConfig).mockReturnValue(null)

    const response = await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({ projectId: "p1" }),
      intent: "write",
      buildMessages: () => [],
    })

    expect(response.status).toBe(400)
  })

  it("returns 409 when consistency preflight blocks", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    vi.mocked(resolveAIConfig).mockReturnValue({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
    })
    vi.mocked(fetchStoryContext).mockResolvedValue({
      bible: null,
      characters: [],
      consistencyState: undefined,
    })
    vi.mocked(runConsistencyPreflight).mockReturnValue({
      shouldBlock: true,
      highestSeverity: "high",
      violations: [{ severity: "high", category: "forbidden", message: "检测到禁止项冲突" }],
      softFailed: false,
    })

    const response = await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({ projectId: "p1", text: "some text" }),
      intent: "write",
      buildMessages: () => [],
    })

    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json.errorType).toBe("consistency_high_risk")
  })

  it("skips consistency preflight when intentConfig says so", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    vi.mocked(resolveAIConfig).mockReturnValue({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
    })
    vi.mocked(fetchStoryContext).mockResolvedValue({
      bible: null,
      characters: [],
    })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "ctx" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("ok", { status: 200 })
    )

    await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({ projectId: "p1" }),
      intent: "brainstorm", // brainstorm has consistencyPreflight: false
      buildMessages: () => [{ role: "user", content: "hi" }],
    })

    expect(runConsistencyPreflight).not.toHaveBeenCalled()
  })

  it("calls buildMessages with body and fullContext", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    vi.mocked(resolveAIConfig).mockReturnValue({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
    })
    vi.mocked(fetchStoryContext).mockResolvedValue({
      bible: null,
      characters: [],
    })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "story context here" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("ok", { status: 200 })
    )

    const buildMessages = vi.fn(() => [
      { role: "system" as const, content: "sys" },
      { role: "user" as const, content: "usr" },
    ])

    await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({ projectId: "p1", text: "hello" }),
      intent: "expand",
      buildMessages,
    })

    expect(buildMessages).toHaveBeenCalledWith({
      body: { projectId: "p1", text: "hello" },
      fullContext: "story context here",
    })
  })

  it("passes correct options to createOpenAIStreamResponse", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    const aiConfig = { baseUrl: "https://api.test.com/v1", apiKey: "key", modelId: "model-1" }
    vi.mocked(resolveAIConfig).mockReturnValue(aiConfig)
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
    vi.mocked(extractRetryMeta).mockReturnValue({ isRetry: true })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("stream", { status: 200 })
    )

    const messages = [
      { role: "system" as const, content: "sys prompt" },
      { role: "user" as const, content: "user prompt" },
    ]

    const response = await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({
        projectId: "p1",
        documentId: "d1",
        _isRetry: true,
      }),
      intent: "expand", // temperature: 0.8, maxTokens: 1500
      buildMessages: () => messages,
    })

    expect(response.status).toBe(200)
    expect(createOpenAIStreamResponse).toHaveBeenCalledWith(
      {
        messages,
        maxTokens: 1500,
        temperature: 0.8,
        ...aiConfig,
      },
      expect.objectContaining({
        supabase: mockSupabase,
        userId: "u1",
        projectId: "p1",
        documentId: "d1",
        feature: "expand",
        isRetry: true,
      })
    )
  })

  it("uses null for documentId when not provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    vi.mocked(resolveAIConfig).mockReturnValue({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
    })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("ok", { status: 200 })
    )

    await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({ projectId: "p1" }),
      intent: "chat",
      buildMessages: () => [{ role: "user", content: "hi" }],
    })

    expect(createOpenAIStreamResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ documentId: null })
    )
  })

  it("returns 500 on unexpected error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    vi.mocked(resolveAIConfig).mockReturnValue({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
    })
    vi.mocked(fetchStoryContext).mockRejectedValue(new Error("DB down"))

    const response = await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({ projectId: "p1" }),
      intent: "write",
      buildMessages: () => [],
    })

    expect(response.status).toBe(500)
  })

  it("truncates promptLog to 200 characters", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    vi.mocked(resolveAIConfig).mockReturnValue({
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      modelId: "model-1",
    })
    vi.mocked(fetchStoryContext).mockResolvedValue({ bible: null, characters: [] })
    vi.mocked(buildStoryPromptContext).mockReturnValue({ fullContext: "" })
    vi.mocked(createOpenAIStreamResponse).mockResolvedValue(
      new Response("ok", { status: 200 })
    )

    const longContent = "x".repeat(500)
    await runStreamingPipeline({
      supabase: mockSupabase,
      request: makeRequest({ projectId: "p1" }),
      intent: "chat",
      buildMessages: () => [
        { role: "system", content: longContent },
        { role: "user", content: longContent },
      ],
    })

    const telemetryArg = vi.mocked(createOpenAIStreamResponse).mock.calls[0][1]
    expect(telemetryArg.promptLog.length).toBeLessThanOrEqual(200)
  })
})
