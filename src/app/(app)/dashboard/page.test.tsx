/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import DashboardPage from "./page"

interface MockProject {
  id: string
  user_id: string
  title: string
}

interface MockDocument {
  id: string
  project_id: string
  title: string
  updated_at: string
}

interface MockQueryError {
  message: string
}

interface MockSupabaseResult<T> {
  data: T[] | null
  error: MockQueryError | null
}

interface MockSupabaseControls {
  documentsSelect: ReturnType<typeof vi.fn>
  documentsIn: ReturnType<typeof vi.fn>
}

function mockSupabaseData({
  projectsResult,
  documentsResult,
}: {
  projectsResult: MockSupabaseResult<MockProject>
  documentsResult: MockSupabaseResult<MockDocument>
}): MockSupabaseControls {
  const projectsOrder = vi.fn().mockResolvedValue(projectsResult)
  const projectsEq = vi.fn().mockReturnValue({ order: projectsOrder })
  const projectsSelect = vi.fn().mockReturnValue({ eq: projectsEq })

  const documentsOrder = vi.fn().mockResolvedValue(documentsResult)
  const documentsIn = vi.fn().mockReturnValue({ order: documentsOrder })
  const documentsSelect = vi.fn().mockReturnValue({ in: documentsIn })

  type SupabaseClient = Awaited<ReturnType<typeof createClient>>

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: "user-1", email: "writer@example.com" },
        },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "projects") {
        return {
          select: projectsSelect,
        }
      }

      if (table === "documents") {
        return {
          select: documentsSelect,
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  } as unknown as SupabaseClient)

  return {
    documentsSelect,
    documentsIn,
  }
}

async function renderDashboardPageWithData({
  projectsResult,
  documentsResult,
}: {
  projectsResult: MockSupabaseResult<MockProject>
  documentsResult: MockSupabaseResult<MockDocument>
}) {
  const controls = mockSupabaseData({ projectsResult, documentsResult })
  render(await DashboardPage())
  return controls
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it("no longer renders welcome-only copy", async () => {
    await renderDashboardPageWithData({
      projectsResult: {
        data: [{ id: "project-1", user_id: "user-1", title: "长篇小说" }],
        error: null,
      },
      documentsResult: {
        data: [
          {
            id: "doc-1",
            project_id: "project-1",
            title: "第一章",
            updated_at: "2026-03-03T10:00:00Z",
          },
        ],
        error: null,
      },
    })

    expect(screen.queryByText("开始创作")).toBeNull()
  })

  it("shows continue writing action when documents exist", async () => {
    await renderDashboardPageWithData({
      projectsResult: {
        data: [{ id: "project-1", user_id: "user-1", title: "长篇小说" }],
        error: null,
      },
      documentsResult: {
        data: [
          {
            id: "doc-1",
            project_id: "project-1",
            title: "第一章",
            updated_at: "2026-03-03T10:00:00Z",
          },
        ],
        error: null,
      },
    })

    expect(screen.getByRole("button", { name: "继续写作" })).not.toBeNull()
    expect(screen.getByRole("button", { name: "继续最近文档" })).not.toBeNull()
  })

  it("shows create project recommendation and skips documents query when no projects", async () => {
    const controls = await renderDashboardPageWithData({
      projectsResult: {
        data: [],
        error: null,
      },
      documentsResult: {
        data: [],
        error: null,
      },
    })

    expect(screen.getByRole("button", { name: "创建项目" })).not.toBeNull()
    expect(controls.documentsSelect).not.toHaveBeenCalled()
    expect(controls.documentsIn).not.toHaveBeenCalled()
  })

  it("shows create first document recommendation when projects exist without docs", async () => {
    await renderDashboardPageWithData({
      projectsResult: {
        data: [{ id: "project-1", user_id: "user-1", title: "长篇小说" }],
        error: null,
      },
      documentsResult: {
        data: [],
        error: null,
      },
    })

    expect(screen.getByRole("button", { name: "创建首个文档" })).not.toBeNull()
  })

  it("falls back to create project recommendation when project query fails", async () => {
    const controls = await renderDashboardPageWithData({
      projectsResult: {
        data: null,
        error: { message: "db unavailable" },
      },
      documentsResult: {
        data: [
          {
            id: "doc-1",
            project_id: "project-1",
            title: "第一章",
            updated_at: "2026-03-03T10:00:00Z",
          },
        ],
        error: null,
      },
    })

    expect(screen.getByRole("button", { name: "创建项目" })).not.toBeNull()
    expect(controls.documentsSelect).not.toHaveBeenCalled()
  })

  it("falls back to create first document recommendation when document query fails", async () => {
    await renderDashboardPageWithData({
      projectsResult: {
        data: [{ id: "project-1", user_id: "user-1", title: "长篇小说" }],
        error: null,
      },
      documentsResult: {
        data: null,
        error: { message: "db unavailable" },
      },
    })

    expect(screen.getByRole("button", { name: "创建首个文档" })).not.toBeNull()
  })
})
