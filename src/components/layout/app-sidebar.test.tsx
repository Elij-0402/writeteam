/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppSidebar } from "./app-sidebar"
import type { Document, Project } from "@/types/database"
import { toast } from "sonner"
import {
  createProject,
  deleteProject,
  updateProject,
} from "@/app/actions/projects"
import { createDocument, deleteDocument } from "@/app/actions/documents"

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock("@/app/actions/projects", () => ({
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  updateProject: vi.fn(),
}))

vi.mock("@/app/actions/documents", () => ({
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
}))

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children, ...props }: React.ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarContent: ({ children, ...props }: React.ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarFooter: ({ children, ...props }: React.ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarHeader: ({ children, ...props }: React.ComponentProps<"div">) => (
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
    asChild,
    ...props
  }: React.ComponentProps<"button"> & { asChild?: boolean }) =>
    asChild ? <div>{children}</div> : <button {...props}>{children}</button>,
  SidebarMenuAction: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  SidebarMenuSub: ({ children, ...props }: React.ComponentProps<"ul">) => (
    <ul {...props}>{children}</ul>
  ),
  SidebarMenuSubItem: ({ children, ...props }: React.ComponentProps<"li">) => (
    <li {...props}>{children}</li>
  ),
  SidebarMenuSubButton: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  SidebarGroup: ({ children, ...props }: React.ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarGroupContent: ({ children, ...props }: React.ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarSeparator: (props: React.ComponentProps<"hr">) => <hr {...props} />,
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode; align?: string; side?: string }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button role="menuitem" {...props}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock("@/components/layout/nav-user", () => ({
  NavUser: ({ displayName, email }: { displayName: string; email: string }) => (
    <div>
      {displayName}-{email}
    </div>
  ),
}))

vi.mock("@/components/dashboard/project-edit-dialog", () => ({
  ProjectEditDialog: ({
    open,
    project,
    onSave,
  }: {
    open: boolean
    project: Project | null
    onOpenChange: (open: boolean) => void
    onSave: (projectId: string, formData: FormData) => Promise<void>
  }) => {
    const [loading, setLoading] = useState(false)

    if (!open || !project) {
      return null
    }

    return (
      <div>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            const formData = new FormData()
            formData.append("title", "更新后的标题")
            await onSave(project.id, formData)
            setLoading(false)
          }}
        >
          {loading ? "保存中" : "保存项目修改"}
        </button>
      </div>
    )
  },
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

function renderSidebar(onDocumentsChange?: () => void) {
  return render(
    <AppSidebar
      projects={[makeProject()]}
      documentsByProject={{ "proj-1": [makeDocument()] }}
      activeDocumentId={null}
      userDisplayName="测试用户"
      userEmail="user@example.com"
      onSelectDocument={vi.fn()}
      onDocumentsChange={onDocumentsChange}
    />
  )
}

beforeEach(() => {
  vi.mocked(createProject).mockResolvedValue({
    data: makeProject({ id: "proj-2", title: "新项目" }),
  })
  vi.mocked(deleteProject).mockResolvedValue({ success: true })
  vi.mocked(updateProject).mockResolvedValue({ success: true })
  vi.mocked(createDocument).mockResolvedValue({
    data: makeDocument({ id: "doc-2", title: "新文档" }),
  })
  vi.mocked(deleteDocument).mockResolvedValue({ success: true })
  vi.mocked(toast.error).mockReset()
})

afterEach(() => {
  cleanup()
})

describe("AppSidebar", () => {
  it("keeps global area focused on global actions", () => {
    renderSidebar()

    expect(screen.getByRole("button", { name: "新建项目" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "新建文档" })).toBeNull()
    expect(screen.getByRole("menuitem", { name: "新建文档" })).toBeTruthy()
  })

  it("provides create-document action from project menu", async () => {
    const user = userEvent.setup()
    const onDocumentsChange = vi.fn()
    renderSidebar(onDocumentsChange)

    await user.click(screen.getByRole("menuitem", { name: "新建文档" }))

    await waitFor(() => {
      expect(createDocument).toHaveBeenCalledWith("proj-1", expect.any(FormData))
    })
    expect(onDocumentsChange).toHaveBeenCalledOnce()
  })

  it("shows error feedback and avoids misleading navigation on action errors", async () => {
    const user = userEvent.setup()
    const onDocumentsChange = vi.fn()

    vi.mocked(createProject).mockResolvedValue({ error: "创建项目失败" })
    vi.mocked(deleteProject).mockResolvedValue({ error: "删除项目失败" })
    vi.mocked(createDocument).mockResolvedValue({ error: "backend: timeout from provider" })
    vi.mocked(deleteDocument).mockResolvedValue({ error: "删除文档失败" })
    vi.mocked(updateProject).mockResolvedValue({ error: "更新项目失败" })

    renderSidebar(onDocumentsChange)

    await user.click(screen.getByRole("button", { name: "新建项目" }))
    await user.type(screen.getByLabelText("标题"), "失败项目")
    await user.click(screen.getByRole("button", { name: "创建" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("创建项目失败")
    })
    expect(onDocumentsChange).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { name: "新建项目" })).toBeTruthy()

    await user.click(screen.getByRole("menuitem", { name: "新建文档" }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("操作失败，请稍后重试")
    })
    expect(onDocumentsChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole("menuitem", { name: "删除项目" }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("删除项目失败")
    })
    expect(onDocumentsChange).not.toHaveBeenCalled()

    await user.click(screen.getByLabelText("删除 第一章"))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("删除文档失败")
    })
    expect(onDocumentsChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole("menuitem", { name: "编辑项目" }))
    await user.click(screen.getByRole("button", { name: "保存项目修改" }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("更新项目失败")
    })
    expect(onDocumentsChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "保存项目修改" })).toBeTruthy()
  })

  it("shows fallback toast when create and delete flows throw", async () => {
    const user = userEvent.setup()
    const onDocumentsChange = vi.fn()

    vi.mocked(createProject).mockRejectedValue(new Error("boom"))
    vi.mocked(deleteProject).mockRejectedValue(new Error("boom"))

    renderSidebar(onDocumentsChange)

    await user.click(screen.getByRole("button", { name: "新建项目" }))
    await user.type(screen.getByLabelText("标题"), "异常项目")
    await user.click(screen.getByRole("button", { name: "创建" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("操作失败，请稍后重试")
    })
    expect(onDocumentsChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole("menuitem", { name: "删除项目" }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(2)
    })
    expect(toast.error).toHaveBeenLastCalledWith("操作失败，请稍后重试")
    expect(onDocumentsChange).not.toHaveBeenCalled()
  })

  it("keeps save pending while project update request is in flight", async () => {
    const user = userEvent.setup()
    vi.mocked(updateProject).mockClear()
    let resolveUpdate: (value: { success: boolean }) => void = () => {}
    const updatePromise = new Promise<{ success: boolean }>((resolve) => {
      resolveUpdate = resolve
    })
    vi.mocked(updateProject).mockReturnValue(updatePromise)

    renderSidebar()

    await user.click(screen.getByRole("menuitem", { name: "编辑项目" }))
    const saveButton = screen.getByRole("button", { name: "保存项目修改" })

    await user.click(saveButton)
    expect(updateProject).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "保存中" }))
    expect(updateProject).toHaveBeenCalledTimes(1)

    resolveUpdate({ success: true })

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "保存中" })).toBeNull()
    })
  })
})
