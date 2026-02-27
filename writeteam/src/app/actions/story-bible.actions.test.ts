import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { createCharacter, deleteCharacter, updateCharacter } from "./story-bible"

type User = { id: string }

function buildCharactersTable(options?: {
  maybeSingleResults?: Array<{ data: unknown; error: null | { message: string } }>
  singleResults?: Array<{ data: unknown; error: null | { message: string } }>
}) {
  const maybeSingleResults = [...(options?.maybeSingleResults ?? [])]
  const singleResults = [...(options?.singleResults ?? [])]

  const table = {
    select: vi.fn(() => table),
    eq: vi.fn(() => table),
    neq: vi.fn(() => table),
    insert: vi.fn(() => table),
    update: vi.fn(() => table),
    maybeSingle: vi.fn(async () => maybeSingleResults.shift() ?? { data: null, error: null }),
    single: vi.fn(async () => singleResults.shift() ?? { data: null, error: null }),
  }

  return table
}

function buildDeleteCharactersTable() {
  let eqCount = 0
  const table = {
    delete: vi.fn(() => table),
    eq: vi.fn(() => {
      eqCount += 1
      if (eqCount >= 2) {
        return Promise.resolve({ error: null })
      }
      return table
    }),
  }
  return table
}

function mockSupabaseClient(user: User | null, charactersTable: Record<string, unknown>) {
  const from = vi.fn((table: string) => {
    if (table !== "characters") {
      throw new Error(`unexpected table: ${table}`)
    }
    return charactersTable
  })

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from,
  } as never)
}

describe("story-bible Server Action auth and isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects create/update/delete when user is unauthenticated", async () => {
    const table = buildCharactersTable()
    mockSupabaseClient(null, table)

    const formData = new FormData()
    formData.set("name", "林晚")

    await expect(createCharacter("project-1", formData)).resolves.toEqual({ error: "未登录" })
    await expect(updateCharacter("char-1", { name: "新名字" })).resolves.toEqual({ error: "未登录" })
    await expect(deleteCharacter("char-1", "project-1")).resolves.toEqual({ error: "未登录" })
  })

  it("scopes createCharacter conflict check and insert to current user", async () => {
    const table = buildCharactersTable({
      maybeSingleResults: [{ data: null, error: null }],
      singleResults: [{ data: { id: "char-1" }, error: null }],
    })
    mockSupabaseClient({ id: "user-1" }, table)

    const formData = new FormData()
    formData.set("name", "林晚")
    formData.set("role", "导师")

    const result = await createCharacter("project-1", formData)

    expect(result).toEqual({ data: { id: "char-1" } })
    expect(table.eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(table.insert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: "project-1", user_id: "user-1", name: "林晚" })
    )
  })

  it("checks user isolation and duplicate name when updating character name", async () => {
    const table = buildCharactersTable({
      maybeSingleResults: [
        { data: { project_id: "project-1" }, error: null },
        { data: null, error: null },
        { data: { project_id: "project-1" }, error: null },
      ],
    })
    mockSupabaseClient({ id: "user-1" }, table)

    const result = await updateCharacter("char-1", { name: "  新名字  " })

    expect(result).toEqual({ success: true })
    expect(table.eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(table.eq).toHaveBeenCalledWith("project_id", "project-1")
    expect(table.neq).toHaveBeenCalledWith("id", "char-1")
  })

  it("returns actionable duplicate error when update name conflicts", async () => {
    const table = buildCharactersTable({
      maybeSingleResults: [
        { data: { project_id: "project-1" }, error: null },
        { data: { id: "char-2" }, error: null },
      ],
    })
    mockSupabaseClient({ id: "user-1" }, table)

    const result = await updateCharacter("char-1", { name: "冲突名" })

    expect(result).toEqual({ error: "保存失败：存在同名角色，请修改角色名称后重试。" })
  })

  it("scopes deleteCharacter by current user", async () => {
    const table = buildDeleteCharactersTable()
    mockSupabaseClient({ id: "user-1" }, table)

    const result = await deleteCharacter("char-1", "project-1")

    expect(result).toEqual({ success: true })
    expect(table.eq).toHaveBeenCalledWith("id", "char-1")
    expect(table.eq).toHaveBeenCalledWith("user_id", "user-1")
  })
})
