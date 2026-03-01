import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"

interface QueryResult {
  data: Array<Record<string, unknown>> | null
  error: { message: string } | null
}

function makeRequest(query = "") {
  const url = `http://localhost/api/ai/failure-analysis${query ? `?${query}` : ""}`
  return new Request(url) as unknown as import("next/server").NextRequest
}

function makeSupabase(options?: { userId?: string | null; queryResult?: QueryResult }) {
  const userId = options && "userId" in options ? options.userId ?? null : "u-1"
  const queryResult = options?.queryResult ?? { data: [], error: null }

  const queryBuilder = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    gte: vi.fn(() => queryBuilder),
    order: vi.fn(() => queryBuilder),
    range: vi.fn(() => queryBuilder),
    limit: vi.fn(() => queryBuilder),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(resolve(queryResult)),
  }

  const from = vi.fn(() => queryBuilder)

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
    from,
  }

  return {
    client,
    from,
    eq: queryBuilder.eq,
    range: queryBuilder.range,
  }
}

describe("GET /api/ai/failure-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when user is not logged in", async () => {
    const { client, from } = makeSupabase({ userId: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "未登录",
      },
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("returns stable empty structure when no data", async () => {
    const { client } = makeSupabase({ queryResult: { data: [], error: null } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await GET(makeRequest("range=7d"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.summary.totalCalls).toBe(0)
    expect(data.data.summary.totalFailures).toBe(0)
    expect(data.data.distributions.byProvider).toEqual([])
    expect(data.data.topFailureCombos).toEqual([])
    expect(data.data.recommendations).toEqual([])
  })

  it("supports single model filter", async () => {
    const rows = [
      {
        project_id: "p-1",
        document_id: "d-1",
        provider: "DeepSeek",
        model: "deepseek-chat",
        attempted_model: null,
        error_type: "timeout",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        project_id: "p-1",
        document_id: "d-2",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "timeout",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
    ]
    const { client } = makeSupabase({ queryResult: { data: rows, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await GET(makeRequest("model=deepseek-chat"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.summary.totalFailures).toBe(1)
    expect(data.data.distributions.byModel).toEqual([{ model: "deepseek-chat", count: 1 }])
  })

  it("supports multi-filter and keeps dual failure metrics", async () => {
    const rows = [
      {
        project_id: "p-1",
        document_id: "d-1",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "rate_limit",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        project_id: "p-1",
        document_id: "d-2",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "rate_limit",
        recovery_status: "recovered_retry",
        created_at: "2026-02-28T00:00:00.000Z",
      },
    ]

    const { client, eq } = makeSupabase({ queryResult: { data: rows, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await GET(makeRequest("provider=OpenAI&errorType=rate_limit&range=24h"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(eq).toHaveBeenCalledWith("error_type", "rate_limit")
    expect(data.data.summary.totalCalls).toBe(2)
    expect(data.data.summary.totalFailures).toBe(1)
    expect(data.data.summary.failureRate).toBe(50)
    expect(data.data.summary.failureByDefinition.recoveryStatusFailure).toBe(1)
    expect(data.data.summary.failureByDefinition.errorTypeNonNull).toBe(2)
    expect(data.data.summary.failureByDefinition.unionFailure).toBe(2)
  })

  it("supports recovery_status filter", async () => {
    const rows = [
      {
        project_id: "p-1",
        document_id: "d-1",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "timeout",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        project_id: "p-2",
        document_id: "d-2",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "timeout",
        recovery_status: "recovered_retry",
        created_at: "2026-02-28T00:00:00.000Z",
      },
    ]
    const { client, eq } = makeSupabase({ queryResult: { data: rows, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await GET(makeRequest("recoveryStatus=failure"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(eq).toHaveBeenCalledWith("recovery_status", "failure")
    expect(data.data.summary.totalFailures).toBe(1)
  })

  it("sorts top failure combos by count desc", async () => {
    const rows = [
      {
        project_id: "p-1",
        document_id: "d-1",
        provider: "DeepSeek",
        model: "deepseek-chat",
        attempted_model: null,
        error_type: "timeout",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        project_id: "p-1",
        document_id: "d-2",
        provider: "DeepSeek",
        model: "deepseek-chat",
        attempted_model: null,
        error_type: "timeout",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        project_id: "p-2",
        document_id: "d-3",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "auth",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
    ]

    const { client } = makeSupabase({ queryResult: { data: rows, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.topFailureCombos[0]).toMatchObject({
      provider: "DeepSeek",
      model: "deepseek-chat",
      errorType: "timeout",
      count: 2,
    })
    expect(data.data.topFailureCombos[1]).toMatchObject({
      provider: "OpenAI",
      model: "gpt-4o-mini",
      errorType: "auth",
      count: 1,
    })
  })
})
