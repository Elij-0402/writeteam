import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { addProjectToSeries, getSeriesBible, updateSeries, updateSeriesBible } from "./series"

type User = { id: string }

function buildSeriesTable(seriesExists: boolean) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: seriesExists ? { id: "series-1" } : null, error: null })),
        })),
      })),
    })),
  }
}

function buildProjectsUpdateTable() {
  const table = {
    update: vi.fn(() => table),
    eq: vi.fn(() => table),
  }

  table.eq
    .mockImplementationOnce(() => table)
    .mockImplementationOnce(async () => ({ error: null }))

  return table
}

function buildSeriesBibleReadTable() {
  const table = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: "bible-1" }, error: null })),
        })),
      })),
    })),
  }

  return table
}

function buildSeriesBibleWriteTable(existing: boolean) {
  const updateTable = {
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
    insert: vi.fn(async () => ({ error: null })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: existing ? { id: "bible-1" } : null, error: null })),
        })),
      })),
    })),
  }

  return updateTable
}

function mockSupabaseClient(user: User | null, handlers: Record<string, unknown>) {
  const from = vi.fn((table: string) => {
    const target = handlers[table]
    if (!target) {
      throw new Error(`unexpected table: ${table}`)
    }
    return target
  })

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from,
  } as never)
}

describe("series actions auth boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("blocks project-series binding when target series is not owned by current user", async () => {
    mockSupabaseClient(
      { id: "user-1" },
      {
        series: buildSeriesTable(false),
        projects: buildProjectsUpdateTable(),
      }
    )

    const result = await addProjectToSeries("project-1", "series-1")
    expect(result).toEqual({ error: "操作失败：该系列不存在或无权限访问，请刷新后重试。" })
  })

  it("allows project-series binding when target series belongs to current user", async () => {
    const projects = buildProjectsUpdateTable()
    mockSupabaseClient(
      { id: "user-1" },
      {
        series: buildSeriesTable(true),
        projects,
      }
    )

    const result = await addProjectToSeries("project-1", "series-1")

    expect(result).toEqual({ success: true })
    expect(projects.update).toHaveBeenCalled()
  })

  it("rejects getSeriesBible when series ownership validation fails", async () => {
    mockSupabaseClient(
      { id: "user-1" },
      {
        series: buildSeriesTable(false),
        series_bibles: buildSeriesBibleReadTable(),
      }
    )

    const result = await getSeriesBible("series-1")
    expect(result).toEqual({ error: "操作失败：该系列不存在或无权限访问，请刷新后重试。", data: null })
  })

  it("rejects updateSeriesBible when series ownership validation fails", async () => {
    mockSupabaseClient(
      { id: "user-1" },
      {
        series: buildSeriesTable(false),
        series_bibles: buildSeriesBibleWriteTable(false),
      }
    )

    const result = await updateSeriesBible("series-1", { notes: "共享设定" })
    expect(result).toEqual({ error: "操作失败：该系列不存在或无权限访问，请刷新后重试。" })
  })

  it("sanitizes updateSeries payload and blocks sensitive fields", async () => {
    let eqCount = 0
    const seriesTable = {
      update: vi.fn(() => seriesTable),
      eq: vi.fn(() => {
        eqCount += 1
        if (eqCount >= 2) {
          return Promise.resolve({ error: null })
        }
        return seriesTable
      }),
    }

    mockSupabaseClient(
      { id: "user-1" },
      {
        series: seriesTable,
      }
    )

    const result = await updateSeries("series-1", {
      title: "新系列名",
      user_id: "evil-user",
      id: "evil-id",
    })

    expect(result).toEqual({ success: true })
    const payload = vi.mocked(seriesTable.update).mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.title).toBe("新系列名")
    expect(payload).not.toHaveProperty("user_id")
    expect(payload).not.toHaveProperty("id")
    expect(payload).toHaveProperty("updated_at")
  })

  it("sanitizes updateSeriesBible insert payload and prevents overriding owner fields", async () => {
    const seriesBibles = buildSeriesBibleWriteTable(false)
    mockSupabaseClient(
      { id: "user-1" },
      {
        series: buildSeriesTable(true),
        series_bibles: seriesBibles,
      }
    )

    const result = await updateSeriesBible("series-1", {
      notes: "共享设定",
      user_id: "evil-user",
      series_id: "evil-series",
    })

    expect(result).toEqual({ success: true })
    const payload = vi.mocked(seriesBibles.insert).mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.series_id).toBe("series-1")
    expect(payload.user_id).toBe("user-1")
    expect(payload.notes).toBe("共享设定")
  })
})
