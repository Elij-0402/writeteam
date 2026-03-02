# Dashboard 全站布局统一重设计 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the split Dashboard/Editor layouts with a unified three-panel shell (left sidebar project tree, center content, right AI chat) using shadcn/ui's dual sidebar pattern.

**Architecture:** All pages share one `AppShell` component wrapping `SidebarProvider` with left `AppSidebar` (project/document tree navigation), center `SidebarInset` (route content), and right `AISidebar` (AI Chat panel). The editor-shell.tsx monolith (1237 lines) is decomposed: its left sidebar and header move into the global shell, its right panel logic consolidates into the unified AI Chat, and the editor-specific content becomes `EditorContent`.

**Tech Stack:** Next.js 16 (App Router), React 19, shadcn/ui sidebar component (already installed at `src/components/ui/sidebar.tsx`), Tailwind CSS v4, TipTap, Supabase.

**Design Doc:** `docs/plans/2026-03-03-dashboard-redesign-design.md`

---

## Phase 1: Shared Components (no routing changes)

### Task 1: ProseModeSelector Shared Component

Extract the duplicated prose mode selector into a shared component.

**Files:**
- Create: `src/components/ai/prose-mode-selector.tsx`
- Test: `src/components/ai/prose-mode-selector.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/ai/prose-mode-selector.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ProseModeSelector } from "./prose-mode-selector"

describe("ProseModeSelector", () => {
  it("renders with default value", () => {
    render(<ProseModeSelector value="default" onChange={() => {}} />)
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("shows all 6 prose modes", async () => {
    const user = userEvent.setup()
    render(<ProseModeSelector value="default" onChange={() => {}} />)
    await user.click(screen.getByRole("combobox"))
    expect(screen.getByText("跟随故事圣经")).toBeInTheDocument()
    expect(screen.getByText("均衡")).toBeInTheDocument()
    expect(screen.getByText("电影感")).toBeInTheDocument()
    expect(screen.getByText("抒情")).toBeInTheDocument()
    expect(screen.getByText("极简")).toBeInTheDocument()
    expect(screen.getByText("模仿风格")).toBeInTheDocument()
  })

  it("calls onChange when selection changes", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ProseModeSelector value="default" onChange={onChange} />)
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByText("电影感"))
    expect(onChange).toHaveBeenCalledWith("cinematic")
  })

  it("disables match-style when hasStyleSample is false", async () => {
    const user = userEvent.setup()
    render(
      <ProseModeSelector
        value="default"
        onChange={() => {}}
        hasStyleSample={false}
      />
    )
    await user.click(screen.getByRole("combobox"))
    // match-style option should be disabled
    const matchOption = screen.getByText("模仿风格")
    expect(matchOption.closest("[data-disabled]")).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ai/prose-mode-selector.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the component**

```tsx
// src/components/ai/prose-mode-selector.tsx
"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PROSE_MODES = [
  { value: "default", label: "跟随故事圣经" },
  { value: "balanced", label: "均衡" },
  { value: "cinematic", label: "电影感" },
  { value: "lyrical", label: "抒情" },
  { value: "minimal", label: "极简" },
  { value: "match-style", label: "模仿风格" },
] as const

export type ProseMode = (typeof PROSE_MODES)[number]["value"]

interface ProseModeSelectProps {
  value: ProseMode
  onChange: (value: ProseMode) => void
  hasStyleSample?: boolean
  className?: string
}

export function ProseModeSelector({
  value,
  onChange,
  hasStyleSample = true,
  className,
}: ProseModeSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ProseMode)}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROSE_MODES.map((mode) => (
          <SelectItem
            key={mode.value}
            value={mode.value}
            disabled={mode.value === "match-style" && !hasStyleSample}
          >
            {mode.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ai/prose-mode-selector.test.tsx`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/components/ai/prose-mode-selector.tsx src/components/ai/prose-mode-selector.test.tsx
git commit -m "feat: extract shared ProseModeSelector component"
```

---

### Task 2: SiteHeader Component

Create the unified top header bar with sidebar triggers and breadcrumbs.

**Files:**
- Create: `src/components/layout/site-header.tsx`
- Test: `src/components/layout/site-header.test.tsx`
- Reference: `src/components/ui/sidebar.tsx` (for `SidebarTrigger`, `useSidebar`)

**Step 1: Write the failing test**

```tsx
// src/components/layout/site-header.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SiteHeader } from "./site-header"

// Mock the sidebar hook
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button data-testid="sidebar-trigger" className={className}>≡</button>
  ),
  useSidebar: () => ({ state: "expanded", toggleSidebar: vi.fn() }),
}))

describe("SiteHeader", () => {
  it("renders breadcrumb with project and document names", () => {
    render(
      <SiteHeader
        projectTitle="我的小说"
        documentTitle="第一章"
      />
    )
    expect(screen.getByText("我的小说")).toBeInTheDocument()
    expect(screen.getByText("第一章")).toBeInTheDocument()
  })

  it("renders sidebar trigger", () => {
    render(<SiteHeader />)
    expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument()
  })

  it("renders word count when provided", () => {
    render(<SiteHeader wordCount={2340} />)
    expect(screen.getByText(/2,340/)).toBeInTheDocument()
  })

  it("renders AI sidebar toggle button", () => {
    render(<SiteHeader onToggleAISidebar={() => {}} />)
    expect(screen.getByLabelText("切换 AI 助手")).toBeInTheDocument()
  })

  it("renders focus mode toggle", () => {
    render(
      <SiteHeader
        focusMode={false}
        onToggleFocusMode={() => {}}
      />
    )
    expect(screen.getByLabelText("专注模式")).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/site-header.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the component**

```tsx
// src/components/layout/site-header.tsx
"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Maximize2, Minimize2, MessageSquare, LayoutDashboard } from "lucide-react"
import Link from "next/link"

interface SiteHeaderProps {
  projectTitle?: string
  projectId?: string
  documentTitle?: string
  wordCount?: number
  focusMode?: boolean
  onToggleFocusMode?: () => void
  aiSidebarOpen?: boolean
  onToggleAISidebar?: () => void
}

export function SiteHeader({
  projectTitle,
  projectId,
  documentTitle,
  wordCount,
  focusMode,
  onToggleFocusMode,
  aiSidebarOpen,
  onToggleAISidebar,
}: SiteHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          {projectTitle ? (
            <>
              <BreadcrumbItem>
                <BreadcrumbPage>{projectTitle}</BreadcrumbPage>
              </BreadcrumbItem>
              {documentTitle && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{documentTitle}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage>WriteTeam</BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-2">
        {wordCount !== undefined && (
          <span className="text-xs text-muted-foreground">
            {wordCount.toLocaleString()} 字
          </span>
        )}

        {projectId && (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/canvas/${projectId}`}>
              <LayoutDashboard className="h-4 w-4" />
            </Link>
          </Button>
        )}

        {onToggleFocusMode && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleFocusMode}
            aria-label="专注模式"
          >
            {focusMode ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        )}

        {onToggleAISidebar && (
          <Button
            variant={aiSidebarOpen ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={onToggleAISidebar}
            aria-label="切换 AI 助手"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/site-header.test.tsx`
Expected: PASS

**Step 5: Check if breadcrumb component exists, install if needed**

Run: `ls src/components/ui/breadcrumb.tsx 2>/dev/null || npx shadcn@latest add breadcrumb`

**Step 6: Commit**

```bash
git add src/components/layout/site-header.tsx src/components/layout/site-header.test.tsx
git commit -m "feat: add unified SiteHeader with breadcrumbs and sidebar triggers"
```

---

### Task 3: AppSidebar — Left Sidebar with Project/Document Tree

The ChatGPT-style left sidebar containing the project document tree.

**Files:**
- Create: `src/components/layout/app-sidebar.tsx`
- Create: `src/components/layout/project-tree.tsx`
- Create: `src/components/layout/nav-user.tsx`
- Test: `src/components/layout/project-tree.test.tsx`
- Reference: `src/components/ui/sidebar.tsx` (all sidebar sub-components)
- Reference: `src/types/database.ts` (Project, Document types)
- Reference: `src/app/actions/projects.ts` (createProject, deleteProject)
- Reference: `src/app/actions/documents.ts` (createDocument, deleteDocument, reorderDocuments)

**Step 1: Write the failing test for ProjectTree**

```tsx
// src/components/layout/project-tree.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ProjectTree } from "./project-tree"
import type { Project, Document } from "@/types/database"

// Mock sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  SidebarGroup: ({ children }: any) => <div data-testid="sidebar-group">{children}</div>,
  SidebarGroupContent: ({ children }: any) => <div>{children}</div>,
  SidebarGroupLabel: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SidebarMenu: ({ children }: any) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: any) => <li>{children}</li>,
  SidebarMenuButton: ({ children, onClick, isActive, ...props }: any) => (
    <button onClick={onClick} data-active={isActive} {...props}>{children}</button>
  ),
  SidebarMenuAction: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  SidebarMenuSub: ({ children }: any) => <ul>{children}</ul>,
  SidebarMenuSubItem: ({ children }: any) => <li>{children}</li>,
  SidebarMenuSubButton: ({ children, onClick, isActive, ...props }: any) => (
    <button onClick={onClick} data-active={isActive} {...props}>{children}</button>
  ),
}))

const mockProjects: Project[] = [
  {
    id: "p1",
    user_id: "u1",
    title: "我的小说",
    description: null,
    genre: "fantasy",
    cover_image_url: null,
    word_count_goal: null,
    preferred_model: null,
    series_id: null,
    created_at: "2026-01-01",
    updated_at: "2026-03-01",
  },
]

const mockDocuments: Record<string, Document[]> = {
  p1: [
    {
      id: "d1",
      project_id: "p1",
      user_id: "u1",
      title: "第一章",
      content: null,
      content_text: "some text",
      word_count: 100,
      sort_order: 0,
      document_type: "chapter",
      created_at: "2026-01-01",
      updated_at: "2026-03-01",
    },
    {
      id: "d2",
      project_id: "p1",
      user_id: "u1",
      title: "第二章",
      content: null,
      content_text: "",
      word_count: 0,
      sort_order: 1,
      document_type: "chapter",
      created_at: "2026-01-01",
      updated_at: "2026-03-01",
    },
  ],
}

describe("ProjectTree", () => {
  it("renders project names", () => {
    render(
      <ProjectTree
        projects={mockProjects}
        documentsByProject={mockDocuments}
        activeDocumentId={null}
        onSelectDocument={() => {}}
      />
    )
    expect(screen.getByText("我的小说")).toBeInTheDocument()
  })

  it("renders documents under the project", () => {
    render(
      <ProjectTree
        projects={mockProjects}
        documentsByProject={mockDocuments}
        activeDocumentId={null}
        onSelectDocument={() => {}}
      />
    )
    expect(screen.getByText("第一章")).toBeInTheDocument()
    expect(screen.getByText("第二章")).toBeInTheDocument()
  })

  it("calls onSelectDocument when document is clicked", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <ProjectTree
        projects={mockProjects}
        documentsByProject={mockDocuments}
        activeDocumentId={null}
        onSelectDocument={onSelect}
      />
    )
    await user.click(screen.getByText("第一章"))
    expect(onSelect).toHaveBeenCalledWith("p1", "d1")
  })

  it("highlights active document", () => {
    render(
      <ProjectTree
        projects={mockProjects}
        documentsByProject={mockDocuments}
        activeDocumentId="d1"
        onSelectDocument={() => {}}
      />
    )
    const btn = screen.getByText("第一章").closest("button")
    expect(btn?.dataset.active).toBe("true")
  })

  it("shows empty state when no projects", () => {
    render(
      <ProjectTree
        projects={[]}
        documentsByProject={{}}
        activeDocumentId={null}
        onSelectDocument={() => {}}
      />
    )
    expect(screen.getByText("创建第一个项目")).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/project-tree.test.tsx`
Expected: FAIL — module not found

**Step 3: Write ProjectTree component**

```tsx
// src/components/layout/project-tree.tsx
"use client"

import { useState } from "react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight, FileText, FolderOpen, MoreHorizontal, Plus, Pencil, Trash2, ArrowUp, ArrowDown, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Project, Document } from "@/types/database"

interface ProjectTreeProps {
  projects: Project[]
  documentsByProject: Record<string, Document[]>
  activeDocumentId: string | null
  onSelectDocument: (projectId: string, documentId: string) => void
  onCreateDocument?: (projectId: string) => void
  onDeleteDocument?: (documentId: string, projectId: string) => void
  onRenameDocument?: (documentId: string, currentTitle: string) => void
  onReorderDocument?: (documentId: string, projectId: string, direction: "up" | "down") => void
  onEditProject?: (project: Project) => void
  onDeleteProject?: (projectId: string) => void
  onOpenCanvas?: (projectId: string) => void
}

export function ProjectTree({
  projects,
  documentsByProject,
  activeDocumentId,
  onSelectDocument,
  onCreateDocument,
  onDeleteDocument,
  onRenameDocument,
  onReorderDocument,
  onEditProject,
  onDeleteProject,
  onOpenCanvas,
}: ProjectTreeProps) {
  const [openProjects, setOpenProjects] = useState<Set<string>>(() => {
    // Auto-expand project containing active document
    if (activeDocumentId) {
      for (const [projectId, docs] of Object.entries(documentsByProject)) {
        if (docs.some((d) => d.id === activeDocumentId)) {
          return new Set([projectId])
        }
      }
    }
    // Auto-expand first project
    if (projects.length > 0) return new Set([projects[0].id])
    return new Set()
  })

  const toggleProject = (projectId: string) => {
    setOpenProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  if (projects.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">还没有项目</p>
            <Button variant="outline" size="sm" className="mt-2">
              创建第一个项目
            </Button>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {projects.map((project) => {
            const docs = documentsByProject[project.id] || []
            const isOpen = openProjects.has(project.id)

            return (
              <Collapsible
                key={project.id}
                open={isOpen}
                onOpenChange={() => toggleProject(project.id)}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                      <span className="truncate">{project.title}</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction>
                        <MoreHorizontal className="h-4 w-4" />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      {onCreateDocument && (
                        <DropdownMenuItem onClick={() => onCreateDocument(project.id)}>
                          <Plus className="mr-2 h-4 w-4" />
                          新建文档
                        </DropdownMenuItem>
                      )}
                      {onEditProject && (
                        <DropdownMenuItem onClick={() => onEditProject(project)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑项目
                        </DropdownMenuItem>
                      )}
                      {onOpenCanvas && (
                        <DropdownMenuItem onClick={() => onOpenCanvas(project.id)}>
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Canvas
                        </DropdownMenuItem>
                      )}
                      {onDeleteProject && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDeleteProject(project.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除项目
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {docs.map((doc) => (
                        <SidebarMenuSubItem key={doc.id}>
                          <SidebarMenuSubButton
                            isActive={doc.id === activeDocumentId}
                            onClick={() => onSelectDocument(project.id, doc.id)}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="truncate">{doc.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                      {docs.length === 0 && (
                        <div className="px-4 py-2 text-xs text-muted-foreground">
                          暂无文档
                        </div>
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/project-tree.test.tsx`
Expected: PASS (all 5 tests)

**Step 5: Write NavUser component**

```tsx
// src/components/layout/nav-user.tsx
"use client"

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChevronsUpDown, LogOut } from "lucide-react"
import { signOut } from "@/app/actions/auth"
import { toast } from "sonner"

interface NavUserProps {
  displayName: string
  email: string
}

export function NavUser({ displayName, email }: NavUserProps) {
  const handleSignOut = async () => {
    const result = await signOut()
    if (result?.error) toast.error(result.error)
  }

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials || "U"}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto h-4 w-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-56" align="start">
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
```

**Step 6: Write AppSidebar component**

```tsx
// src/components/layout/app-sidebar.tsx
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PenLine, Plus, Settings, BookOpen, Search } from "lucide-react"
import { ProjectTree } from "./project-tree"
import { NavUser } from "./nav-user"
import { createProject, deleteProject, updateProject } from "@/app/actions/projects"
import { createDocument, deleteDocument, reorderDocuments } from "@/app/actions/documents"
import type { Project, Document } from "@/types/database"
import { toast } from "sonner"

interface AppSidebarProps {
  projects: Project[]
  documentsByProject: Record<string, Document[]>
  activeDocumentId: string | null
  userDisplayName: string
  userEmail: string
  onSelectDocument: (projectId: string, documentId: string) => void
  onDocumentsChange?: () => void
}

export function AppSidebar({
  projects: initialProjects,
  documentsByProject: initialDocsByProject,
  activeDocumentId,
  userDisplayName,
  userEmail,
  onSelectDocument,
  onDocumentsChange,
}: AppSidebarProps) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [documentsByProject, setDocumentsByProject] = useState(initialDocsByProject)
  const [searchQuery, setSearchQuery] = useState("")
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  // Filter projects and documents by search query
  const filteredProjects = searchQuery
    ? projects.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (documentsByProject[p.id] || []).some((d) =>
            d.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : projects

  const handleCreateProject = useCallback(async (formData: FormData) => {
    const result = await createProject(formData)
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.data) {
      setProjects((prev) => [result.data!, ...prev])
      setNewProjectOpen(false)
      toast.success("项目已创建")
      router.push(`/editor/${result.data.id}`)
    }
  }, [router])

  const handleCreateDocument = useCallback(async (projectId: string) => {
    const docs = documentsByProject[projectId] || []
    const formData = new FormData()
    formData.set("title", `第 ${docs.length + 1} 章`)
    formData.set("documentType", "chapter")
    const result = await createDocument(projectId, formData)
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.data) {
      setDocumentsByProject((prev) => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), result.data!],
      }))
      onSelectDocument(projectId, result.data.id)
      onDocumentsChange?.()
    }
  }, [documentsByProject, onSelectDocument, onDocumentsChange])

  const handleDeleteProject = useCallback(async (projectId: string) => {
    const result = await deleteProject(projectId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    setDocumentsByProject((prev) => {
      const next = { ...prev }
      delete next[projectId]
      return next
    })
    toast.success("项目已删除")
  }, [])

  const handleDeleteDocument = useCallback(async (docId: string, projectId: string) => {
    const result = await deleteDocument(docId, projectId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setDocumentsByProject((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] || []).filter((d) => d.id !== docId),
    }))
    onDocumentsChange?.()
  }, [onDocumentsChange])

  const handleOpenCanvas = useCallback((projectId: string) => {
    router.push(`/canvas/${projectId}`)
  }, [router])

  return (
    <>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="font-bold">
                <PenLine className="h-5 w-5" />
                <span>WriteTeam</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索文档..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setNewProjectOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <ProjectTree
            projects={filteredProjects}
            documentsByProject={documentsByProject}
            activeDocumentId={activeDocumentId}
            onSelectDocument={onSelectDocument}
            onCreateDocument={handleCreateDocument}
            onDeleteDocument={handleDeleteDocument}
            onDeleteProject={handleDeleteProject}
            onOpenCanvas={handleOpenCanvas}
          />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/series">
                  <BookOpen className="h-4 w-4" />
                  <span>系列管理</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/settings">
                  <Settings className="h-4 w-4" />
                  <span>设置</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarSeparator />
          <NavUser displayName={userDisplayName} email={userEmail} />
        </SidebarFooter>
      </Sidebar>

      {/* New Project Dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <form action={handleCreateProject}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">项目名称</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="genre">类型</Label>
                <Select name="genre" defaultValue="other">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fantasy">奇幻</SelectItem>
                    <SelectItem value="scifi">科幻</SelectItem>
                    <SelectItem value="romance">言情</SelectItem>
                    <SelectItem value="mystery">悬疑</SelectItem>
                    <SelectItem value="horror">恐怖</SelectItem>
                    <SelectItem value="literary">文学</SelectItem>
                    <SelectItem value="wuxia">武侠</SelectItem>
                    <SelectItem value="xianxia">仙侠</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">创建</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Step 7: Commit**

```bash
git add src/components/layout/app-sidebar.tsx src/components/layout/project-tree.tsx src/components/layout/project-tree.test.tsx src/components/layout/nav-user.tsx
git commit -m "feat: add AppSidebar with project document tree navigation"
```

---

### Task 4: AISidebar — Right AI Chat Panel

Wrap the existing AIChatPanel into a right sidebar.

**Files:**
- Create: `src/components/layout/ai-sidebar.tsx`
- Test: `src/components/layout/ai-sidebar.test.tsx`
- Reference: `src/components/ai/ai-chat-panel.tsx`
- Reference: `src/components/ui/sidebar.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/layout/ai-sidebar.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AISidebar } from "./ai-sidebar"

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children, side }: any) => <aside data-side={side}>{children}</aside>,
  SidebarHeader: ({ children }: any) => <div data-testid="sidebar-header">{children}</div>,
  SidebarContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("@/components/ai/ai-chat-panel", () => ({
  default: () => <div data-testid="ai-chat-panel">AI Chat Panel</div>,
}))

describe("AISidebar", () => {
  it("renders as a right sidebar", () => {
    render(
      <AISidebar
        projectId="p1"
        documentId="d1"
        documentContent="test content"
        onInsertToEditor={() => {}}
        hasStyleSample={false}
      />
    )
    expect(screen.getByText("AI 助手")).toBeInTheDocument()
    const sidebar = screen.getByText("AI 助手").closest("[data-side]")
    expect(sidebar?.getAttribute("data-side")).toBe("right")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/ai-sidebar.test.tsx`
Expected: FAIL — module not found

**Step 3: Write AISidebar component**

```tsx
// src/components/layout/ai-sidebar.tsx
"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"
import AIChatPanel from "@/components/ai/ai-chat-panel"

interface AISidebarProps {
  projectId: string
  documentId: string | null
  documentContent: string
  onInsertToEditor: (text: string) => void
  hasStyleSample: boolean
}

export function AISidebar({
  projectId,
  documentId,
  documentContent,
  onInsertToEditor,
  hasStyleSample,
}: AISidebarProps) {
  return (
    <Sidebar
      side="right"
      collapsible="offcanvas"
      className="border-l"
    >
      <SidebarHeader className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">AI 助手</h3>
      </SidebarHeader>
      <SidebarContent className="p-0">
        <AIChatPanel
          projectId={projectId}
          documentId={documentId}
          documentContent={documentContent}
          onInsertToEditor={onInsertToEditor}
          hasStyleSample={hasStyleSample}
        />
      </SidebarContent>
    </Sidebar>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/ai-sidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/layout/ai-sidebar.tsx src/components/layout/ai-sidebar.test.tsx
git commit -m "feat: add AISidebar right panel wrapping AI Chat"
```

---

### Task 5: WelcomePage Component

The empty state page when no document is selected.

**Files:**
- Create: `src/components/layout/welcome-page.tsx`

**Step 1: Write the component**

```tsx
// src/components/layout/welcome-page.tsx
"use client"

import { PenLine, FileText, Sparkles, BookOpen } from "lucide-react"

export function WelcomePage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <PenLine className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">开始创作</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          从左侧选择一个项目和文档开始写作，或创建新项目
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-xs text-muted-foreground">选择文档</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xs text-muted-foreground">AI 辅助</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-xs text-muted-foreground">故事圣经</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/layout/welcome-page.tsx
git commit -m "feat: add WelcomePage empty state component"
```

---

### Task 6: AppShell — Global Layout Shell

The top-level layout component that wraps everything.

**Files:**
- Create: `src/components/layout/app-shell.tsx`
- Reference: All components from Tasks 2-5

**Step 1: Write the component**

```tsx
// src/components/layout/app-shell.tsx
"use client"

import { useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { AISidebar } from "./ai-sidebar"
import { SiteHeader } from "./site-header"
import type { Project, Document, StoryBible, Character } from "@/types/database"

interface AppShellProps {
  projects: Project[]
  documentsByProject: Record<string, Document[]>
  userDisplayName: string
  userEmail: string
  children: React.ReactNode
  // Editor-specific props (passed when in editor context)
  activeProjectId?: string
  activeDocumentId?: string
  activeProjectTitle?: string
  activeDocumentTitle?: string
  wordCount?: number
  documentContent?: string
  hasStyleSample?: boolean
  onInsertToEditor?: (text: string) => void
}

export function AppShell({
  projects,
  documentsByProject,
  userDisplayName,
  userEmail,
  children,
  activeProjectId,
  activeDocumentId,
  activeProjectTitle,
  activeDocumentTitle,
  wordCount,
  documentContent = "",
  hasStyleSample = false,
  onInsertToEditor,
}: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [focusMode, setFocusMode] = useState(false)
  const [aiSidebarOpen, setAISidebarOpen] = useState(false)

  const isEditorPage = pathname?.startsWith("/editor/")

  const handleSelectDocument = useCallback(
    (projectId: string, documentId: string) => {
      router.push(`/editor/${projectId}?doc=${documentId}`)
    },
    [router]
  )

  const handleInsertToEditor = useCallback(
    (text: string) => {
      onInsertToEditor?.(text)
    },
    [onInsertToEditor]
  )

  if (focusMode) {
    return (
      <div className="flex h-screen flex-col">
        <SiteHeader
          projectTitle={activeProjectTitle}
          projectId={activeProjectId}
          documentTitle={activeDocumentTitle}
          wordCount={wordCount}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode(false)}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    )
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "16rem",
      } as React.CSSProperties}
    >
      <AppSidebar
        projects={projects}
        documentsByProject={documentsByProject}
        activeDocumentId={activeDocumentId || null}
        userDisplayName={userDisplayName}
        userEmail={userEmail}
        onSelectDocument={handleSelectDocument}
      />

      <SidebarInset>
        <SiteHeader
          projectTitle={activeProjectTitle}
          projectId={activeProjectId}
          documentTitle={activeDocumentTitle}
          wordCount={wordCount}
          focusMode={focusMode}
          onToggleFocusMode={isEditorPage ? () => setFocusMode(true) : undefined}
          aiSidebarOpen={aiSidebarOpen}
          onToggleAISidebar={
            isEditorPage ? () => setAISidebarOpen((prev) => !prev) : undefined
          }
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </SidebarInset>

      {isEditorPage && aiSidebarOpen && activeProjectId && (
        <AISidebar
          projectId={activeProjectId}
          documentId={activeDocumentId || null}
          documentContent={documentContent}
          onInsertToEditor={handleInsertToEditor}
          hasStyleSample={hasStyleSample}
        />
      )}
    </SidebarProvider>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "feat: add AppShell global layout with dual sidebars"
```

---

## Phase 2: Routing Restructure

### Task 7: Create Unified Data-Fetching Layout

Replace the separate `(dashboard)/layout.tsx` and `(editor)/layout.tsx` with a unified layout that fetches all projects and wraps children in `AppShell`.

**Files:**
- Create: `src/app/(app)/layout.tsx` (new route group)
- Modify: `src/lib/supabase/middleware.ts` (update redirect target)

**Step 1: Create the new unified layout**

```tsx
// src/app/(app)/layout.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/layout/app-shell"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Fetch all projects with their documents
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // Fetch all documents grouped by project
  const projectIds = (projects || []).map((p) => p.id)
  const { data: allDocuments } = await supabase
    .from("documents")
    .select("*")
    .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"])
    .order("sort_order", { ascending: true })

  const documentsByProject: Record<string, typeof allDocuments> = {}
  for (const doc of allDocuments || []) {
    if (!documentsByProject[doc.project_id]) {
      documentsByProject[doc.project_id] = []
    }
    documentsByProject[doc.project_id].push(doc)
  }

  return (
    <AppShell
      projects={projects || []}
      documentsByProject={documentsByProject}
      userDisplayName={profile?.display_name || user.email?.split("@")[0] || "用户"}
      userEmail={user.email || ""}
    >
      {children}
    </AppShell>
  )
}
```

**Step 2: Create the new dashboard page (welcome page)**

```tsx
// src/app/(app)/dashboard/page.tsx
import { WelcomePage } from "@/components/layout/welcome-page"

export default function DashboardPage() {
  return <WelcomePage />
}
```

**Step 3: Move settings and series pages into new route group**

Run:
```bash
mkdir -p src/app/\(app\)/settings src/app/\(app\)/series
cp src/app/\(dashboard\)/settings/page.tsx src/app/\(app\)/settings/page.tsx
cp src/app/\(dashboard\)/series/page.tsx src/app/\(app\)/series/page.tsx
```

Then modify the copied pages to remove their own auth checks (since the layout now handles auth). In each page, remove the `redirect` and `supabase.auth.getUser()` checks since the `(app)/layout.tsx` already handles authentication.

**Step 4: Update middleware redirect target**

In `src/lib/supabase/middleware.ts`, change the redirect for authenticated users on auth pages from `/dashboard` to `/dashboard` (path stays same since it's now under `(app)/dashboard`). No change needed if the path is the same.

**Step 5: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/app/\(app\)/dashboard/page.tsx src/app/\(app\)/settings/page.tsx src/app/\(app\)/series/page.tsx
git commit -m "feat: add unified (app) route group with AppShell layout"
```

---

### Task 8: Migrate Editor Route into Unified Layout

Move the editor route into the new `(app)` route group and create a stripped-down `EditorContent` that removes the sidebar/header from `EditorShell`.

**Files:**
- Create: `src/app/(app)/editor/[id]/page.tsx`
- Create: `src/components/editor/editor-content.tsx` (extracted from editor-shell.tsx)
- Reference: `src/components/editor/editor-shell.tsx` (1237 lines — extracting center editor area)
- Reference: `src/app/(editor)/editor/[id]/page.tsx` (current page)

**Step 1: Create editor page in (app) route group**

Copy the current editor page at `src/app/(editor)/editor/[id]/page.tsx` to `src/app/(app)/editor/[id]/page.tsx`. Modify it to:
1. Keep all data fetching (project, documents, story_bible, characters, plugins)
2. Replace `<EditorShell>` with `<EditorContent>` (the new component)
3. Pass additional props needed by AppShell through a client wrapper

**Step 2: Create EditorContent component**

Extract from `editor-shell.tsx` lines 616-739 (the center editor area) into a new component. This component keeps:
- `WritingEditor` with autosave
- `AIToolbar` above the editor
- `SaveStatusBanner`
- `SaliencyIndicator`
- `SelectionAIMenu` (inside WritingEditor)
- `CommandPalette` and `PluginManager`
- Document content state, selectedText, editorContent
- Saliency detection logic
- All AI feature callbacks (these talk to server endpoints, independent of layout)

It removes:
- Left sidebar (document list, collapse, export/import) → moved to AppSidebar
- Top header (project title, model switcher, focus mode, right panel toggles) → moved to SiteHeader
- Right panel rendering (bible, chat, muse, visualize) → moved to AISidebar
- `ResizablePanelGroup` → no longer needed

This is the largest task. The key is to carefully extract the ~600 lines of editor center logic while keeping the same behavior. Create `EditorContent` with these props:

```typescript
interface EditorContentProps {
  project: Project
  documents: Document[]
  initialDocumentId?: string
  storyBible: StoryBible | null
  characters: Character[]
  plugins?: Plugin[]
  entryContext?: { source: "canvas"; nodeId: string; nodeLabel: string; nodeType: string; nodeSummary: string } | null
  // Callbacks to communicate with AppShell
  onWordCountChange?: (count: number) => void
  onActiveDocumentChange?: (docId: string, docTitle: string) => void
  onContentChange?: (content: string) => void
  onInsertTextRef?: React.MutableRefObject<((text: string) => void) | null>
}
```

**Step 3: Verify the editor works in the new location**

Run: `npm run dev` and navigate to a project/document in the new layout.
Expected: Editor renders correctly with dual sidebars, AIToolbar at top, writing area in center.

**Step 4: Commit**

```bash
git add src/app/\(app\)/editor/\[id\]/page.tsx src/components/editor/editor-content.tsx
git commit -m "feat: add EditorContent extracted from EditorShell monolith"
```

---

## Phase 3: Wire Up Communication

### Task 9: AppShell-EditorContent Communication

Connect the AppShell (which owns the header and sidebars) with EditorContent (which owns the editor state) via refs and callbacks.

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/app/(app)/editor/[id]/page.tsx`

**Step 1: Add a client wrapper for the editor page**

Create a client component that wraps EditorContent and communicates state up to AppShell:

```tsx
// src/app/(app)/editor/[id]/editor-page-client.tsx
"use client"

import { useState, useRef, useCallback } from "react"
import { EditorContent } from "@/components/editor/editor-content"
import { AppShell } from "@/components/layout/app-shell"
import type { Project, Document, StoryBible, Character, Plugin } from "@/types/database"

interface EditorPageClientProps {
  project: Project
  documents: Document[]
  storyBible: StoryBible | null
  characters: Character[]
  plugins: Plugin[]
  entryContext: any
  // AppShell props
  allProjects: Project[]
  documentsByProject: Record<string, Document[]>
  userDisplayName: string
  userEmail: string
  initialDocId?: string
}

export function EditorPageClient({
  project,
  documents,
  storyBible,
  characters,
  plugins,
  entryContext,
  allProjects,
  documentsByProject,
  userDisplayName,
  userEmail,
  initialDocId,
}: EditorPageClientProps) {
  const [wordCount, setWordCount] = useState(0)
  const [activeDocTitle, setActiveDocTitle] = useState("")
  const [activeDocId, setActiveDocId] = useState(initialDocId || documents[0]?.id || "")
  const [documentContent, setDocumentContent] = useState("")
  const insertTextRef = useRef<((text: string) => void) | null>(null)

  const handleInsertToEditor = useCallback((text: string) => {
    insertTextRef.current?.(text)
  }, [])

  return (
    <AppShell
      projects={allProjects}
      documentsByProject={documentsByProject}
      userDisplayName={userDisplayName}
      userEmail={userEmail}
      activeProjectId={project.id}
      activeDocumentId={activeDocId}
      activeProjectTitle={project.title}
      activeDocumentTitle={activeDocTitle}
      wordCount={wordCount}
      documentContent={documentContent}
      hasStyleSample={!!storyBible?.style_sample}
      onInsertToEditor={handleInsertToEditor}
    >
      <EditorContent
        project={project}
        documents={documents}
        initialDocumentId={initialDocId}
        storyBible={storyBible}
        characters={characters}
        plugins={plugins}
        entryContext={entryContext}
        onWordCountChange={setWordCount}
        onActiveDocumentChange={(docId, title) => {
          setActiveDocId(docId)
          setActiveDocTitle(title)
        }}
        onContentChange={setDocumentContent}
        onInsertTextRef={insertTextRef}
      />
    </AppShell>
  )
}
```

**Step 2: Update the editor page.tsx to use the client wrapper**

The server component fetches all data, then renders `<EditorPageClient>`.

**Step 3: Test navigation flow**

Run: `npm run dev`
1. Navigate to `/dashboard` → see welcome page with left sidebar
2. Click a project/document in sidebar → navigate to `/editor/[id]?doc=[docId]`
3. Editor loads with content, AIToolbar works, right AI sidebar toggles

**Step 4: Commit**

```bash
git add src/app/\(app\)/editor/\[id\]/editor-page-client.tsx src/app/\(app\)/editor/\[id\]/page.tsx src/components/layout/app-shell.tsx
git commit -m "feat: wire up AppShell-EditorContent communication"
```

---

## Phase 4: Chat Enhancements

### Task 10: Slash Commands for AI Chat

Add `/muse` and `/visualize` slash commands to the AI Chat panel.

**Files:**
- Create: `src/components/ai/chat-slash-commands.tsx`
- Modify: `src/components/ai/ai-chat-panel.tsx`

**Step 1: Create slash commands component**

```tsx
// src/components/ai/chat-slash-commands.tsx
"use client"

import { useEffect, useState } from "react"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Sparkles, ImageIcon, BookOpen } from "lucide-react"

const SLASH_COMMANDS = [
  {
    command: "/muse what-if",
    label: "灵感 · 如果...",
    description: "生成 What-if 场景",
    icon: Sparkles,
  },
  {
    command: "/muse random",
    label: "灵感 · 随机提示",
    description: "生成随机写作提示",
    icon: Sparkles,
  },
  {
    command: "/muse suggest",
    label: "灵感 · 建议方向",
    description: "分析当前文本并建议方向",
    icon: Sparkles,
  },
  {
    command: "/visualize",
    label: "可视化场景",
    description: "根据描述生成图片",
    icon: ImageIcon,
  },
  {
    command: "/bible",
    label: "故事圣经",
    description: "查看或编辑故事圣经",
    icon: BookOpen,
  },
] as const

interface ChatSlashCommandsProps {
  input: string
  onSelect: (command: string) => void
  visible: boolean
}

export function ChatSlashCommands({ input, onSelect, visible }: ChatSlashCommandsProps) {
  if (!visible) return null

  const query = input.slice(1).toLowerCase()
  const filtered = SLASH_COMMANDS.filter(
    (c) =>
      c.command.toLowerCase().includes(query) ||
      c.label.toLowerCase().includes(query)
  )

  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border bg-popover p-1 shadow-md">
      <Command>
        <CommandList>
          <CommandGroup>
            {filtered.map((cmd) => (
              <CommandItem
                key={cmd.command}
                onSelect={() => onSelect(cmd.command)}
                className="flex items-center gap-2"
              >
                <cmd.icon className="h-4 w-4" />
                <div>
                  <div className="text-sm font-medium">{cmd.label}</div>
                  <div className="text-xs text-muted-foreground">{cmd.description}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
```

**Step 2: Integrate into AI Chat Panel**

Modify `ai-chat-panel.tsx` to:
1. Show `ChatSlashCommands` when input starts with "/"
2. Handle slash command selection by routing to the appropriate API endpoint (`/api/ai/muse` or `/api/ai/visualize`)
3. Display results inline in the chat message stream

**Step 3: Test slash commands**

Run: `npm run dev`, open AI Chat, type `/muse` and verify the command menu appears.

**Step 4: Commit**

```bash
git add src/components/ai/chat-slash-commands.tsx src/components/ai/ai-chat-panel.tsx
git commit -m "feat: add slash commands (/muse, /visualize, /bible) to AI Chat"
```

---

### Task 11: @-Mention System for AI Chat

Add @-mention support for referencing Story Bible, characters, etc. in chat.

**Files:**
- Create: `src/components/ai/chat-mentions.tsx`
- Modify: `src/components/ai/ai-chat-panel.tsx`

**Step 1: Create mentions component**

```tsx
// src/components/ai/chat-mentions.tsx
"use client"

import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { BookOpen, User, Palette } from "lucide-react"
import type { Character } from "@/types/database"

interface MentionItem {
  id: string
  label: string
  type: "story-bible" | "character" | "style"
  icon: typeof BookOpen
}

interface ChatMentionsProps {
  input: string
  cursorPosition: number
  characters: Character[]
  onSelect: (mention: MentionItem) => void
  visible: boolean
}

export function ChatMentions({
  input,
  cursorPosition,
  characters,
  onSelect,
  visible,
}: ChatMentionsProps) {
  if (!visible) return null

  // Extract the @query from the current cursor position
  const textBeforeCursor = input.slice(0, cursorPosition)
  const atIndex = textBeforeCursor.lastIndexOf("@")
  if (atIndex === -1) return null
  const query = textBeforeCursor.slice(atIndex + 1).toLowerCase()

  const items: MentionItem[] = [
    { id: "story-bible", label: "故事圣经", type: "story-bible", icon: BookOpen },
    { id: "style", label: "风格样本", type: "style", icon: Palette },
    ...characters.map((c) => ({
      id: `character:${c.id}`,
      label: c.name,
      type: "character" as const,
      icon: User,
    })),
  ]

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query)
  )

  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border bg-popover p-1 shadow-md">
      <Command>
        <CommandList>
          <CommandGroup heading="引用">
            {filtered.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => onSelect(item)}
                className="flex items-center gap-2"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
```

**Step 2: Integrate into AI Chat Panel**

Modify `ai-chat-panel.tsx` to:
1. Accept `characters` prop
2. Show `ChatMentions` when input contains "@" followed by text
3. When a mention is selected, replace the "@query" in the input with a formatted mention tag
4. When sending the message, include the mentioned context in the API request headers or body

**Step 3: Commit**

```bash
git add src/components/ai/chat-mentions.tsx src/components/ai/ai-chat-panel.tsx
git commit -m "feat: add @-mention system for Story Bible and characters in AI Chat"
```

---

## Phase 5: Cleanup & Migration

### Task 12: Switch Default Routes

Update the middleware to redirect authenticated users to the new `(app)` route group and mark old routes as deprecated.

**Files:**
- Modify: `src/lib/supabase/middleware.ts` (if redirect paths need updating)
- Modify: `src/proxy.ts` (if it wraps middleware)

**Step 1: Verify the middleware redirect**

Read `src/proxy.ts` and `src/lib/supabase/middleware.ts` to confirm the redirect target. If it redirects to `/dashboard`, no change needed (the new `(app)/dashboard/page.tsx` will handle it).

**Step 2: Test all routes**

Run: `npm run dev`
- `/login` → login page (unauthenticated)
- `/dashboard` → welcome page with sidebar (authenticated)
- `/editor/[id]` → editor with unified layout
- `/settings` → settings within unified layout
- `/series` → series within unified layout

**Step 3: Commit**

```bash
git commit -m "chore: verify routing works with new unified layout"
```

---

### Task 13: Delete Old Components

Remove deprecated components once the new layout is fully working.

**Files:**
- Delete: `src/components/dashboard/dashboard-content.tsx`
- Delete: `src/components/dashboard/dashboard-header.tsx`
- Delete: `src/components/dashboard/project-grid.tsx`
- Delete: `src/components/dashboard/project-card.tsx`
- Delete old route groups (after confirming new ones work)

**Step 1: Run the build to check for import errors**

Run: `npm run build`
Expected: No errors referencing deleted components

**Step 2: Delete files**

```bash
rm src/components/dashboard/dashboard-content.tsx
rm src/components/dashboard/dashboard-header.tsx
rm src/components/dashboard/project-grid.tsx
rm src/components/dashboard/project-card.tsx
```

**Step 3: Remove old route group pages**

```bash
rm -rf src/app/\(dashboard\)/dashboard/
```

Keep `(dashboard)/layout.tsx`, `(dashboard)/settings/`, `(dashboard)/series/` temporarily as fallback, or delete if fully migrated.

**Step 4: Run lint and build again**

Run: `npm run lint && npm run build`
Expected: Clean build with no errors

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated dashboard components and old route group"
```

---

### Task 14: Final Integration Test

End-to-end verification of the complete new layout.

**Step 1: Run all tests**

Run: `npm run test`
Expected: All tests pass

**Step 2: Manual smoke test checklist**

- [ ] Login → redirects to `/dashboard` with welcome page
- [ ] Left sidebar shows all projects, expandable to documents
- [ ] Click document → navigates to editor, content loads
- [ ] AIToolbar (top) works: 续写, 扩写, etc.
- [ ] Text selection → SelectionAIMenu appears
- [ ] Right AI sidebar toggles open/close
- [ ] AI Chat sends messages and streams responses
- [ ] Type `/muse` in chat → slash command menu appears
- [ ] Type `@` in chat → mention menu appears
- [ ] Focus mode hides both sidebars
- [ ] Sidebar collapses to icon mode
- [ ] Settings page renders in unified layout
- [ ] Series page renders in unified layout
- [ ] Autosave works correctly
- [ ] Canvas link works from header
- [ ] Mobile responsive: sidebars become sheet overlays

**Step 3: Run build**

Run: `npm run build`
Expected: Production build succeeds

**Step 4: Commit**

```bash
git commit --allow-empty -m "chore: dashboard unified layout redesign complete"
```
