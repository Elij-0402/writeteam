import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"

type AuthUserId = string | null

interface UpdateResult {
  data: Array<{ id: string }> | null
  error: { message: string } | null
}

interface LookupResult {
  data: Array<{ id: string; user_rating: number | null }> | null
  error: { message: string } | null
}

function makeRequest(body: unknown) {
  return {
    json: vi.fn(async () => body),
  } as unknown as Request
}

function makeInvalidJsonRequest() {
  return {
    json: vi.fn(async () => {
      throw new Error("invalid json")
    }),
  } as unknown as Request
}

function makeSupabase(options?: {
  userId?: AuthUserId
  updateResult?: UpdateResult
  lookupResult?: LookupResult
}) {
  const userId = options && "userId" in options ? options.userId ?? null : "u-1"
  const updateResult = options?.updateResult ?? {
    data: [{ id: "h-1" }],
    error: null,
  }
  const lookupResult = options?.lookupResult ?? {
    data: [{ id: "h-1", user_rating: null }],
    error: null,
  }

  const updateSelect = vi.fn(async () => updateResult)
  const updateIs = vi.fn(() => ({ select: updateSelect }))
  const updateEqUser = vi.fn(() => ({ is: updateIs }))
  const updateEqId = vi.fn(() => ({ eq: updateEqUser }))
  const update = vi.fn(() => ({ eq: updateEqId }))

  const lookupLimit = vi.fn(async () => lookupResult)
  const lookupOrder = vi.fn(() => ({ limit: lookupLimit }))
  const lookupEqFingerprint = vi.fn(() => ({ order: lookupOrder }))
  const lookupEqFeature = vi.fn(() => ({ eq: lookupEqFingerprint }))
  const lookupEqProject = vi.fn(() => ({ eq: lookupEqFeature }))
  const lookupEqUser = vi.fn(() => ({ eq: lookupEqProject }))
  const lookupSelect = vi.fn(() => ({ eq: lookupEqUser }))

  const from = vi.fn(() => ({ update, select: lookupSelect }))

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
    from,
  }

  return {
    client,
    from,
    update,
    lookupSelect,
  }
}

describe("POST /api/ai/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when user is not logged in", async () => {
    const { client, from } = makeSupabase({ userId: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({}) as never)
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

  it("returns 400 when payload is invalid", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeRequest({ projectId: "", rating: 0 }) as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "反馈参数无效，仅支持 -1 或 1",
      },
    })
  })

  it("returns 400 when request body is not valid JSON", async () => {
    const { client } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makeInvalidJsonRequest() as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "请求体不是有效的 JSON",
      },
    })
  })

  it("returns 404 when no matching AI response exists", async () => {
    const { client, from } = makeSupabase({
      updateResult: { data: [], error: null },
      lookupResult: { data: [], error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        feature: "quick-edit",
        responseFingerprint: "fp-1",
        rating: 1,
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "未找到对应的 AI 响应",
      },
    })
    expect(from).toHaveBeenCalledTimes(1)
  })

  it("returns 409 when duplicate feedback is submitted", async () => {
    const { client, from } = makeSupabase({
      updateResult: { data: [], error: null },
      lookupResult: { data: [{ id: "h-1", user_rating: 1 }], error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        feature: "quick-edit",
        responseFingerprint: "fp-1",
        rating: -1,
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data).toEqual({
      success: false,
      error: {
        code: "ALREADY_RATED",
        message: "该 AI 响应已反馈过，不能重复提交",
      },
      existingRating: 1,
    })
    expect(from).toHaveBeenCalledTimes(1)
  })

  it("returns 200 when feedback is written successfully", async () => {
    const { client, from, update } = makeSupabase({
      updateResult: { data: [{ id: "h-1" }], error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(
      makeRequest({
        projectId: "p-1",
        feature: "quick-edit",
        responseFingerprint: "fp-1",
        rating: 1,
      }) as never
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(from).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        user_rating: 1,
      })
    )
  })
})
