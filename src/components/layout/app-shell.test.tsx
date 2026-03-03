/* @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "./app-shell"
import type { Document, Project } from "@/types/database"

const mockPush = vi.fn()
const mockUsePathname = vi.fn()
const mockUseEditorContext = vi.fn()
const mockSiteHeader = vi.fn<(props: unknown) => void>()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockUsePathname(),
}))

vi.mock("@/components/editor/editor-context", () => ({
  useEditorContext: () => mockUseEditorContext(),
}))

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("./app-sidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}))

vi.mock("./site-header", () => ({
  SiteHeader: (props: unknown) => {
    mockSiteHeader(props)
    return <div data-testid="site-header" />
  },
}))

vi.mock("./ai-sidebar", () => ({
  AISidebar: () => <div data-testid="ai-sidebar" />,
}))

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    user_id: "user-1",
    title: "测试项目",
    description: null,
    genre: null,
    cover_image_url: null,
    word_count_goal: null,
    preferred_model: null,
    series_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    project_id: "proj-1",
    user_id: "user-1",
    title: "第一章",
    content: null,
    content_text: null,
    word_count: 0,
    sort_order: 0,
    document_type: "chapter",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  }
}

function renderShell({
  projects,
  documentsByProject,
}: {
  projects: Project[]
  documentsByProject: Record<string, Document[]>
}) {
  render(
    <AppShell
      projects={projects}
      documentsByProject={documentsByProject}
      userDisplayName="测试用户"
      userEmail="user@example.com"
    >
      <div>child</div>
    </AppShell>
  )
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseEditorContext.mockReturnValue(null)
  })

  afterEach(() => {
    cleanup()
  })

  it("uses create-project status in header on dashboard with no projects", () => {
    mockUsePathname.mockReturnValue("/dashboard")

    renderShell({
      projects: [],
      documentsByProject: {},
    })

    expect(mockSiteHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        contextStatus: "unselected",
        contextStatusLabel: "下一步：创建项目",
      })
    )
  })

  it("uses resume status in header on dashboard when documents exist", () => {
    mockUsePathname.mockReturnValue("/dashboard")

    renderShell({
      projects: [makeProject()],
      documentsByProject: { "proj-1": [makeDocument()] },
    })

    expect(mockSiteHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        contextStatus: "resumable",
        contextStatusLabel: "下一步：继续最近文档",
      })
    )
  })

  it("uses editor context status on editor routes", () => {
    mockUsePathname.mockReturnValue("/editor/proj-1")
    mockUseEditorContext.mockReturnValue({
      activeProjectId: "proj-1",
      activeProjectTitle: "测试项目",
      activeDocumentId: "doc-1",
      activeDocumentTitle: "第一章",
    })

    renderShell({
      projects: [makeProject()],
      documentsByProject: { "proj-1": [makeDocument()] },
    })

    expect(mockSiteHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        contextStatus: "resumable",
        contextStatusLabel: undefined,
      })
    )
  })
})
