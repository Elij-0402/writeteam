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

function mockSupabaseData({
  projects,
  documents,
}: {
  projects: MockProject[]
  documents: MockDocument[]
}) {
  const projectsOrder = vi.fn().mockResolvedValue({ data: projects, error: null })
  const projectsEq = vi.fn().mockReturnValue({ order: projectsOrder })
  const projectsSelect = vi.fn().mockReturnValue({ eq: projectsEq })

  const documentsOrder = vi.fn().mockResolvedValue({ data: documents, error: null })
  const documentsIn = vi.fn().mockReturnValue({ order: documentsOrder })
  const documentsSelect = vi.fn().mockReturnValue({ in: documentsIn })

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
  } as never)
}

async function renderDashboardPageWithData({
  projects,
  documents,
}: {
  projects: MockProject[]
  documents: MockDocument[]
}) {
  mockSupabaseData({ projects, documents })
  render(await DashboardPage())
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it("no longer renders welcome-only copy", async () => {
    await renderDashboardPageWithData({
      projects: [{ id: "project-1", user_id: "user-1", title: "长篇小说" }],
      documents: [
        {
          id: "doc-1",
          project_id: "project-1",
          title: "第一章",
          updated_at: "2026-03-03T10:00:00Z",
        },
      ],
    })

    expect(screen.queryByText("开始创作")).toBeNull()
  })

  it("shows continue writing action when documents exist", async () => {
    await renderDashboardPageWithData({
      projects: [{ id: "project-1", user_id: "user-1", title: "长篇小说" }],
      documents: [
        {
          id: "doc-1",
          project_id: "project-1",
          title: "第一章",
          updated_at: "2026-03-03T10:00:00Z",
        },
      ],
    })

    expect(screen.getByRole("button", { name: "继续写作" })).not.toBeNull()
  })

  it("shows create project recommendation when no projects", async () => {
    await renderDashboardPageWithData({
      projects: [],
      documents: [],
    })

    expect(screen.getByRole("button", { name: "创建项目" })).not.toBeNull()
  })
})
