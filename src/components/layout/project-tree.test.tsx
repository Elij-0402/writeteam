/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ProjectTree } from "./project-tree"
import type { Project, Document } from "@/types/database"

// Mock sidebar components to avoid needing SidebarProvider context
vi.mock("@/components/ui/sidebar", () => ({
  SidebarGroup: ({ children, ...props }: React.ComponentProps<"div">) => (
    <div data-testid="sidebar-group" {...props}>{children}</div>
  ),
  SidebarGroupContent: ({ children, ...props }: React.ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarMenu: ({ children, ...props }: React.ComponentProps<"ul">) => (
    <ul {...props}>{children}</ul>
  ),
  SidebarMenuItem: ({ children, ...props }: React.ComponentProps<"li">) => (
    <li {...props}>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
    ...props
  }: React.ComponentProps<"button"> & { isActive?: boolean; asChild?: boolean; tooltip?: string }) => (
    <button data-active={isActive ?? false} {...props}>{children}</button>
  ),
  SidebarMenuAction: ({ children, ...props }: React.ComponentProps<"button"> & { showOnHover?: boolean }) => (
    <button {...props}>{children}</button>
  ),
  SidebarMenuSub: ({ children, ...props }: React.ComponentProps<"ul">) => (
    <ul {...props}>{children}</ul>
  ),
  SidebarMenuSubItem: ({ children, ...props }: React.ComponentProps<"li">) => (
    <li {...props}>{children}</li>
  ),
  SidebarMenuSubButton: ({
    children,
    isActive,
    ...props
  }: React.ComponentProps<"button"> & { isActive?: boolean; asChild?: boolean }) => (
    <button data-active={isActive ?? false} {...props}>{children}</button>
  ),
}))

// Mock Collapsible
vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({
    children,
    open,
    ...props
  }: React.ComponentProps<"div"> & { open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <div data-open={open} {...props}>{children}</div>
  ),
  CollapsibleTrigger: ({ children, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) => (
    <div data-testid="collapsible-trigger" {...props}>{children}</div>
  ),
  CollapsibleContent: ({ children, ...props }: React.ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
}))

// Mock DropdownMenu
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) => (
    <div {...props}>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode; align?: string }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children, ...props }: React.ComponentProps<"div">) => (
    <div role="menuitem" {...props}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
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
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

describe("ProjectTree", () => {
  it("renders project names", () => {
    const projects = [
      makeProject({ id: "p1", title: "奇幻世界" }),
      makeProject({ id: "p2", title: "科幻未来" }),
    ]
    render(
      <ProjectTree
        projects={projects}
        documentsByProject={{}}
        activeDocumentId={null}
        onSelectDocument={vi.fn()}
      />
    )
    expect(screen.getByText("奇幻世界")).toBeTruthy()
    expect(screen.getByText("科幻未来")).toBeTruthy()
  })

  it("renders documents under projects", () => {
    const projects = [makeProject({ id: "p1", title: "奇幻世界" })]
    const documentsByProject = {
      p1: [
        makeDocument({ id: "d1", project_id: "p1", title: "第一章" }),
        makeDocument({ id: "d2", project_id: "p1", title: "第二章" }),
      ],
    }
    render(
      <ProjectTree
        projects={projects}
        documentsByProject={documentsByProject}
        activeDocumentId={null}
        onSelectDocument={vi.fn()}
      />
    )
    expect(screen.getByText("第一章")).toBeTruthy()
    expect(screen.getByText("第二章")).toBeTruthy()
  })

  it("calls onSelectDocument when document clicked", async () => {
    const user = userEvent.setup()
    const onSelectDocument = vi.fn()
    const projects = [makeProject({ id: "p1", title: "奇幻世界" })]
    const documentsByProject = {
      p1: [makeDocument({ id: "d1", project_id: "p1", title: "第一章" })],
    }
    render(
      <ProjectTree
        projects={projects}
        documentsByProject={documentsByProject}
        activeDocumentId={null}
        onSelectDocument={onSelectDocument}
      />
    )
    await user.click(screen.getByText("第一章"))
    expect(onSelectDocument).toHaveBeenCalledWith("p1", "d1")
  })

  it("highlights active document", () => {
    const projects = [makeProject({ id: "p1", title: "奇幻世界" })]
    const documentsByProject = {
      p1: [
        makeDocument({ id: "d1", project_id: "p1", title: "第一章" }),
        makeDocument({ id: "d2", project_id: "p1", title: "第二章" }),
      ],
    }
    render(
      <ProjectTree
        projects={projects}
        documentsByProject={documentsByProject}
        activeDocumentId="d1"
        onSelectDocument={vi.fn()}
      />
    )
    const activeButton = screen.getByText("第一章").closest("button")
    const inactiveButton = screen.getByText("第二章").closest("button")
    expect(activeButton?.getAttribute("data-active")).toBe("true")
    expect(inactiveButton?.getAttribute("data-active")).toBe("false")
  })

  it("shows empty state when no projects", () => {
    render(
      <ProjectTree
        projects={[]}
        documentsByProject={{}}
        activeDocumentId={null}
        onSelectDocument={vi.fn()}
      />
    )
    expect(screen.getByText("还没有项目")).toBeTruthy()
  })

  it("shows create first project button in empty state when onCreateProject provided", () => {
    render(
      <ProjectTree
        projects={[]}
        documentsByProject={{}}
        activeDocumentId={null}
        onSelectDocument={vi.fn()}
        onCreateProject={() => {}}
      />
    )
    expect(screen.getByText("创建第一个项目")).toBeTruthy()
  })

  it("auto-expands project containing active document", () => {
    const projects = [
      makeProject({ id: "p1", title: "项目一" }),
      makeProject({ id: "p2", title: "项目二" }),
    ]
    const documentsByProject = {
      p1: [makeDocument({ id: "d1", project_id: "p1", title: "第一章" })],
      p2: [makeDocument({ id: "d2", project_id: "p2", title: "第二章" })],
    }
    const { container } = render(
      <ProjectTree
        projects={projects}
        documentsByProject={documentsByProject}
        activeDocumentId="d2"
        onSelectDocument={vi.fn()}
      />
    )
    // The collapsible containing 项目二 should be open
    const collapsibles = container.querySelectorAll("[data-open]")
    const openCollapsibles = Array.from(collapsibles).filter(
      (el) => el.getAttribute("data-open") === "true"
    )
    // At least the project containing the active document should be open
    expect(openCollapsibles.length).toBeGreaterThanOrEqual(1)
  })
})
