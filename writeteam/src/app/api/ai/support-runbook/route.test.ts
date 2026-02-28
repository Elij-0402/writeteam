import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { POST } from "./route"

interface QueryResult {
  data: Array<Record<string, unknown>> | null
  error: { message: string } | null
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai/support-runbook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest
}

function makeInvalidJsonRequest() {
  return new Request("http://localhost/api/ai/support-runbook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{",
  }) as unknown as import("next/server").NextRequest
}

function makeSupabase(options?: { userId?: string | null; queryResult?: QueryResult }) {
  const userId = options && "userId" in options ? options.userId ?? null : "u-1"
  const queryResult = options?.queryResult ?? { data: [], error: null }

  const queryBuilder = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    gte: vi.fn(() => queryBuilder),
    lte: vi.fn(() => queryBuilder),
    order: vi.fn(() => queryBuilder),
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
    gte: queryBuilder.gte,
    lte: queryBuilder.lte,
  }
}

describe("POST /api/ai/support-runbook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when user is not logged in", async () => {
    const { client, from } = makeSupabase({ userId: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({ ticketText: "timeout" }))
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

  it("returns 400 when input is missing", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe("INVALID_INPUT")
  })

  it("returns 400 when request body is invalid JSON", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeInvalidJsonRequest())
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "请求体不是有效 JSON",
      },
    })
  })

  it("builds stable runbook for single error type", async () => {
    const rows = [
      {
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

    const res = await POST(
      makeRequest({
        ticketText: "用户反馈连接超时，点击续写报错",
        targetProvider: "OpenAI",
        targetModel: "gpt-4o-mini",
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.template).toEqual({
      precheck: expect.any(Array),
      diagnosis: expect.any(Array),
      recovery_actions: expect.any(Array),
      verify: expect.any(Array),
      escalation: expect.any(Array),
    })

    const actionTypes = data.data.template.recovery_actions.map((item: { kind: string }) => item.kind)
    expect(actionTypes).toEqual(expect.arrayContaining(["config_check", "switch_model", "retry", "preserve_context"]))
  })

  it("supports mixed error types and returns prioritized runbook", async () => {
    const rows = [
      {
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "rate_limit",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "timeout",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "rate_limit",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
    ]

    const { client } = makeSupabase({ queryResult: { data: rows, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({
        ticketText: "频率限制后又出现超时",
        targetProvider: "OpenAI",
        targetModel: "gpt-4o-mini",
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.primaryErrorType).toBe("rate_limit")
    expect(data.data.errorTypes).toEqual(expect.arrayContaining(["rate_limit", "timeout"]))
  })

  it("applies from/to time filters when provided", async () => {
    const { client, gte, lte } = makeSupabase({ queryResult: { data: [], error: null } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({
        ticketText: "连接超时",
        from: "2026-02-01T00:00:00.000Z",
        to: "2026-02-28T23:59:59.000Z",
      })
    )

    expect(res.status).toBe(200)
    expect(gte).toHaveBeenCalledWith("created_at", "2026-02-01T00:00:00.000Z")
    expect(lte).toHaveBeenCalledWith("created_at", "2026-02-28T23:59:59.000Z")
  })

  it("returns 400 when from/to is invalid datetime", async () => {
    const { client } = makeSupabase({ queryResult: { data: [], error: null } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const fromRes = await POST(
      makeRequest({
        ticketText: "连接超时",
        from: "not-a-date",
      })
    )
    const fromData = await fromRes.json()
    expect(fromRes.status).toBe(400)
    expect(fromData.error.code).toBe("INVALID_INPUT")

    const toRes = await POST(
      makeRequest({
        ticketText: "连接超时",
        to: "also-not-a-date",
      })
    )
    const toData = await toRes.json()
    expect(toRes.status).toBe(400)
    expect(toData.error.code).toBe("INVALID_INPUT")
  })

  it("returns 500 when ai_history query fails", async () => {
    const { client } = makeSupabase({ queryResult: { data: null, error: { message: "db-down" } } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({ ticketText: "连接超时" }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Runbook 数据读取失败，请稍后重试",
      },
    })
  })

  it("uses contextRef-scoped rows for error prioritization", async () => {
    const rows = [
      {
        project_id: "project-a",
        document_id: "doc-a",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "rate_limit",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        project_id: "project-b",
        document_id: "doc-b",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "timeout",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        project_id: "project-b",
        document_id: "doc-b",
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

    const res = await POST(
      makeRequest({
        ticketText: "",
        contextRef: "project-a",
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.primaryErrorType).toBe("rate_limit")
  })

  it("supports prefixed contextRef format", async () => {
    const rows = [
      {
        project_id: "project-a",
        document_id: "doc-a",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "rate_limit",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        project_id: "project-b",
        document_id: "doc-b",
        provider: "OpenAI",
        model: "gpt-4o-mini",
        attempted_model: null,
        error_type: "timeout",
        recovery_status: "failure",
        created_at: "2026-02-28T00:00:00.000Z",
      },
      {
        project_id: "project-b",
        document_id: "doc-b",
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

    const res = await POST(
      makeRequest({
        contextRef: "project:project-a",
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.primaryErrorType).toBe("rate_limit")
  })
})
