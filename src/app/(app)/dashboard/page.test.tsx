/* @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/app/actions/documents", () => ({
  createDocument: vi.fn(),
}))

vi.mock("@/app/actions/projects", () => ({
  createProject: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

interface MockDashboardTaskConsoleProps {
  state: {
    recommendedNextAction: string
    lastEditedDocument?: {
      id: string
      title: string
      updatedAt: string
    }
  }
  recentDocuments: Array<{
    id: string
    title: string
    updatedAt: string
  }>
  onResumeLastDoc: () => Promise<void>
  onCreateProject: () => Promise<void>
  onCreateFirstDoc: () => Promise<void>
}

let lastDashboardTaskConsoleProps: MockDashboardTaskConsoleProps | null = null

vi.mock("@/components/dashboard/dashboard-task-console", () => ({
  DashboardTaskConsole: (props: MockDashboardTaskConsoleProps) => {
    lastDashboardTaskConsoleProps = props
    return <div data-testid="dashboard-task-console" />
  },
}))

import { createDocument } from "@/app/actions/documents"
import { createProject } from "@/app/actions/projects"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
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

function getDashboardTaskConsoleProps(): MockDashboardTaskConsoleProps {
  if (!lastDashboardTaskConsoleProps) {
    throw new Error("DashboardTaskConsole props not captured")
  }

  return lastDashboardTaskConsoleProps
}

function mockRedirectToThrow() {
  vi.mocked(redirect).mockImplementation(() => {
    throw new Error("NEXT_REDIRECT")
  })
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastDashboardTaskConsoleProps = null
    mockRedirectToThrow()
  })

  afterEach(cleanup)

  it("computes resume recommendation when documents exist", async () => {
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

    expect(getDashboardTaskConsoleProps().state.recommendedNextAction).toBe("resume_last_document")
  })

  it("routes resume action through project id and doc query", async () => {
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

    await expect(getDashboardTaskConsoleProps().onResumeLastDoc()).rejects.toThrow("NEXT_REDIRECT")
    expect(redirect).toHaveBeenCalledWith("/editor/project-1?doc=doc-1")
  })

  it("keeps create-project recommendation and skips documents query when no projects", async () => {
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

    expect(getDashboardTaskConsoleProps().state.recommendedNextAction).toBe("create_project")
    expect(controls.documentsSelect).not.toHaveBeenCalled()
    expect(controls.documentsIn).not.toHaveBeenCalled()
  })

  it("creates first doc inside existing project and redirects with doc query", async () => {
    vi.mocked(createDocument).mockResolvedValue({
      data: {
        id: "doc-2",
        project_id: "project-1",
        user_id: "user-1",
        title: "第 1 章",
        content: {},
        content_text: null,
        word_count: 0,
        sort_order: 0,
        document_type: "chapter",
        created_at: "2026-03-03T10:00:00Z",
        updated_at: "2026-03-03T10:00:00Z",
      },
    })

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

    await expect(getDashboardTaskConsoleProps().onCreateFirstDoc()).rejects.toThrow("NEXT_REDIRECT")
    expect(createDocument).toHaveBeenCalledWith("project-1", expect.any(FormData))
    expect(redirect).toHaveBeenCalledWith("/editor/project-1?doc=doc-2")
  })

  it("does not create duplicate chapter when no projects exist", async () => {
    vi.mocked(createProject).mockResolvedValue({
      data: {
        id: "project-2",
        user_id: "user-1",
        title: "未命名项目",
        description: null,
        genre: null,
        cover_image_url: null,
        word_count_goal: null,
        preferred_model: null,
        series_id: null,
        created_at: "2026-03-03T10:00:00Z",
        updated_at: "2026-03-03T10:00:00Z",
      },
    })

    await renderDashboardPageWithData({
      projectsResult: {
        data: [],
        error: null,
      },
      documentsResult: {
        data: [],
        error: null,
      },
    })

    await expect(getDashboardTaskConsoleProps().onCreateFirstDoc()).rejects.toThrow("NEXT_REDIRECT")
    expect(createProject).toHaveBeenCalledOnce()
    expect(createDocument).not.toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith("/editor/project-2")
  })

  it("falls back to create-first-document recommendation when document query fails", async () => {
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

    expect(getDashboardTaskConsoleProps().state.recommendedNextAction).toBe("create_first_document")
  })
})
