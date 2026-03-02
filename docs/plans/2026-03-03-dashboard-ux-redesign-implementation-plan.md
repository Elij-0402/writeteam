# Dashboard UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the monolithic 600-line `dashboard-content.tsx` into decomposed components with modern minimalist visual design (genre-based gradient cards, merged edit dialog, chapter counts).

**Architecture:** Extract 4 new components from the single-file dashboard: `ProjectCard`, `ProjectGrid`, `DashboardHeader`, `ProjectEditDialog`. Add a genre→color utility. Update the server page to query document counts. Delete the redundant rename dialog.

**Tech Stack:** React 19, Next.js 16, shadcn/ui, Tailwind CSS v4, Vitest + @testing-library/react, Supabase

---

### Task 1: Genre Color Map Utility

**Files:**
- Create: `src/lib/genre-colors.ts`
- Test: `src/lib/genre-colors.test.ts`

**Step 1: Write the failing test**

```typescript
/* @vitest-environment node */

import { describe, expect, it } from "vitest"
import { getGenreGradient, GENRES } from "./genre-colors"

describe("getGenreGradient", () => {
  it("returns a gradient string for known genres", () => {
    const result = getGenreGradient("奇幻")
    expect(result).toContain("from-")
    expect(result).toContain("to-")
  })

  it("returns neutral gradient for null/undefined genre", () => {
    expect(getGenreGradient(null)).toContain("from-muted")
    expect(getGenreGradient(undefined)).toContain("from-muted")
  })

  it("returns neutral gradient for unknown genre", () => {
    expect(getGenreGradient("未知题材")).toContain("from-muted")
  })

  it("has a mapping for every genre in the GENRES array", () => {
    for (const genre of GENRES) {
      const result = getGenreGradient(genre)
      expect(result).not.toContain("from-muted")
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/genre-colors.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
export const GENRES = [
  "奇幻",
  "科幻",
  "言情",
  "悬疑",
  "惊悚",
  "恐怖",
  "文学",
  "历史",
  "青少年",
  "儿童",
  "非虚构",
  "其他",
] as const

const GENRE_GRADIENTS: Record<string, string> = {
  奇幻: "from-purple-500/80 to-indigo-500/80",
  科幻: "from-cyan-500/80 to-blue-500/80",
  言情: "from-pink-500/80 to-rose-500/80",
  悬疑: "from-amber-500/80 to-orange-500/80",
  惊悚: "from-red-500/80 to-red-700/80",
  恐怖: "from-gray-500/80 to-gray-700/80",
  文学: "from-green-500/80 to-emerald-500/80",
  历史: "from-amber-700/80 to-yellow-600/80",
  青少年: "from-sky-400/80 to-blue-500/80",
  儿童: "from-yellow-400/80 to-orange-400/80",
  非虚构: "from-slate-400/80 to-gray-500/80",
  其他: "from-zinc-400/80 to-zinc-500/80",
}

const NEUTRAL_GRADIENT = "from-muted/80 to-muted-foreground/20"

export function getGenreGradient(genre: string | null | undefined): string {
  if (!genre) return NEUTRAL_GRADIENT
  return GENRE_GRADIENTS[genre] ?? NEUTRAL_GRADIENT
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/genre-colors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/genre-colors.ts src/lib/genre-colors.test.ts
git commit -m "feat(dashboard): add genre-to-gradient color mapping utility"
```

---

### Task 2: ProjectEditDialog Component

**Files:**
- Create: `src/components/dashboard/project-edit-dialog.tsx`
- Test: `src/components/dashboard/project-edit-dialog.test.tsx`

**Step 1: Write the failing test**

```tsx
/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ProjectEditDialog } from "./project-edit-dialog"
import type { Project } from "@/types/database"

const mockProject: Project = {
  id: "proj-1",
  user_id: "user-1",
  title: "测试小说",
  description: "这是一个测试项目",
  genre: "奇幻",
  cover_image_url: null,
  word_count_goal: null,
  preferred_model: null,
  series_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

describe("ProjectEditDialog", () => {
  it("renders form fields pre-filled with project data when open", () => {
    render(
      <ProjectEditDialog
        project={mockProject}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByLabelText("标题")).toHaveValue("测试小说")
    expect(screen.getByLabelText("简介")).toHaveValue("这是一个测试项目")
  })

  it("renders nothing when project is null", () => {
    const { container } = render(
      <ProjectEditDialog
        project={null}
        open={false}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(container.querySelector("[role='dialog']")).toBeNull()
  })

  it("calls onSave with project id and form data on submit", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <ProjectEditDialog
        project={mockProject}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
      />
    )

    const titleInput = screen.getByLabelText("标题")
    await user.clear(titleInput)
    await user.type(titleInput, "新标题")
    await user.click(screen.getByRole("button", { name: "保存" }))

    expect(onSave).toHaveBeenCalledWith("proj-1", expect.any(FormData))
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/project-edit-dialog.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
"use client"

import { useState, useEffect } from "react"
import type { Project } from "@/types/database"
import { GENRES } from "@/lib/genre-colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface ProjectEditDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (projectId: string, data: FormData) => Promise<void>
}

export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
  onSave,
}: ProjectEditDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [genre, setGenre] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (project && open) {
      setTitle(project.title)
      setDescription(project.description || "")
      setGenre(project.genre || "")
    }
  }, [project, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!project || !title.trim()) return
    setLoading(true)
    const resolvedGenre = genre === "none" ? "" : genre
    const formData = new FormData()
    formData.append("title", title.trim())
    formData.append("description", description)
    formData.append("genre", resolvedGenre)
    await onSave(project.id, formData)
    setLoading(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) {
          setTitle("")
          setDescription("")
          setGenre("")
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>编辑项目信息</DialogTitle>
            <DialogDescription>
              修改项目的标题、简介和题材。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">标题</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="项目标题"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">简介</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述你的项目..."
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-genre">题材</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
                  <SelectValue placeholder="选择题材" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不设置题材</SelectItem>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/project-edit-dialog.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/dashboard/project-edit-dialog.tsx src/components/dashboard/project-edit-dialog.test.tsx
git commit -m "feat(dashboard): extract ProjectEditDialog (merged rename + edit)"
```

---

### Task 3: ProjectCard Component

**Files:**
- Create: `src/components/dashboard/project-card.tsx`
- Test: `src/components/dashboard/project-card.test.tsx`

**Step 1: Write the failing test**

```tsx
/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProjectCard } from "./project-card"
import type { Project } from "@/types/database"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const mockProject: Project = {
  id: "proj-1",
  user_id: "user-1",
  title: "奇幻世界",
  description: "一个关于魔法的故事",
  genre: "奇幻",
  cover_image_url: null,
  word_count_goal: null,
  preferred_model: null,
  series_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
}

describe("ProjectCard", () => {
  it("renders project title and description", () => {
    render(
      <ProjectCard
        project={mockProject}
        documentCount={5}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText("奇幻世界")).toBeInTheDocument()
    expect(screen.getByText("一个关于魔法的故事")).toBeInTheDocument()
  })

  it("renders genre badge and chapter count", () => {
    render(
      <ProjectCard
        project={mockProject}
        documentCount={5}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText(/奇幻/)).toBeInTheDocument()
    expect(screen.getByText(/5 章/)).toBeInTheDocument()
  })

  it("shows '暂无简介' when description is null", () => {
    const noDescProject = { ...mockProject, description: null }
    render(
      <ProjectCard
        project={noDescProject}
        documentCount={0}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText("暂无简介")).toBeInTheDocument()
  })

  it("renders gradient cover area", () => {
    const { container } = render(
      <ProjectCard
        project={mockProject}
        documentCount={3}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    const gradientDiv = container.querySelector("[data-testid='card-cover']")
    expect(gradientDiv).toBeInTheDocument()
  })

  it("links to editor page", () => {
    render(
      <ProjectCard
        project={mockProject}
        documentCount={3}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loading={false}
      />
    )

    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", "/editor/proj-1")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/project-card.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
import Link from "next/link"
import type { Project } from "@/types/database"
import { getGenreGradient } from "@/lib/genre-colors"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, FileEdit, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

interface ProjectCardProps {
  project: Project
  documentCount: number
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  loading: boolean
}

export function ProjectCard({
  project,
  documentCount,
  onEdit,
  onDelete,
  loading,
}: ProjectCardProps) {
  const gradient = getGenreGradient(project.genre)

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/editor/${project.id}`} className="absolute inset-0 z-10" />

      {/* Cover gradient area */}
      <div
        data-testid="card-cover"
        className={`h-24 bg-gradient-to-br ${gradient}`}
        style={
          project.cover_image_url
            ? {
                backgroundImage: `url(${project.cover_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />

      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg leading-tight">
            {project.title}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-20 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(project)
                }}
              >
                <FileEdit className="mr-2 h-4 w-4" />
                编辑信息
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={loading}
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(project)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground">
          {[project.genre, `${documentCount} 章`].filter(Boolean).join(" · ")}
        </p>
      </CardHeader>

      <CardContent className="pb-2">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {project.description || "暂无简介"}
        </p>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        更新于{" "}
        {formatDistanceToNow(new Date(project.updated_at), {
          addSuffix: true,
          locale: zhCN,
        })}
      </CardFooter>
    </Card>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/project-card.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/dashboard/project-card.tsx src/components/dashboard/project-card.test.tsx
git commit -m "feat(dashboard): add ProjectCard with genre gradient cover"
```

---

### Task 4: ProjectGrid + DashboardHeader Components

**Files:**
- Create: `src/components/dashboard/project-grid.tsx`
- Create: `src/components/dashboard/dashboard-header.tsx`
- Test: `src/components/dashboard/project-grid.test.tsx`

**Step 1: Write the failing test**

```tsx
/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProjectGrid } from "./project-grid"
import type { Project } from "@/types/database"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const mockProject: Project = {
  id: "proj-1",
  user_id: "user-1",
  title: "测试项目",
  description: "描述",
  genre: "奇幻",
  cover_image_url: null,
  word_count_goal: null,
  preferred_model: null,
  series_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

describe("ProjectGrid", () => {
  it("renders empty state when no projects", () => {
    render(
      <ProjectGrid
        projects={[]}
        documentCounts={{}}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onNewProject={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText("还没有项目")).toBeInTheDocument()
    expect(screen.getByText("新建项目")).toBeInTheDocument()
  })

  it("renders project cards when projects exist", () => {
    render(
      <ProjectGrid
        projects={[mockProject]}
        documentCounts={{ "proj-1": 3 }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onNewProject={vi.fn()}
        loading={false}
      />
    )

    expect(screen.getByText("测试项目")).toBeInTheDocument()
    expect(screen.queryByText("还没有项目")).not.toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/project-grid.test.tsx`
Expected: FAIL — module not found

**Step 3: Write DashboardHeader (no test needed — pure presentational)**

```tsx
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface DashboardHeaderProps {
  projectCount: number
  onNewProject: () => void
}

export function DashboardHeader({
  projectCount,
  onNewProject,
}: DashboardHeaderProps) {
  return (
    <div className="mb-10 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">我的项目</h1>
        <p className="mt-1 text-muted-foreground">
          {projectCount} 个项目
        </p>
      </div>
      <Button onClick={onNewProject}>
        <Plus className="mr-2 h-4 w-4" />
        新建项目
      </Button>
    </div>
  )
}
```

**Step 4: Write ProjectGrid**

```tsx
import type { Project } from "@/types/database"
import { ProjectCard } from "./project-card"
import { Button } from "@/components/ui/button"
import { BookOpen, Plus } from "lucide-react"

interface ProjectGridProps {
  projects: Project[]
  documentCounts: Record<string, number>
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onNewProject: () => void
  loading: boolean
}

export function ProjectGrid({
  projects,
  documentCounts,
  onEdit,
  onDelete,
  onNewProject,
  loading,
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed">
        <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="mb-2 text-lg font-semibold">还没有项目</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          创建你的第一个项目，开始写作
        </p>
        <Button onClick={onNewProject}>
          <Plus className="mr-2 h-4 w-4" />
          新建项目
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          documentCount={documentCounts[project.id] ?? 0}
          onEdit={onEdit}
          onDelete={onDelete}
          loading={loading}
        />
      ))}
    </div>
  )
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/project-grid.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/dashboard/project-grid.tsx src/components/dashboard/project-grid.test.tsx src/components/dashboard/dashboard-header.tsx
git commit -m "feat(dashboard): add ProjectGrid and DashboardHeader components"
```

---

### Task 5: Data Layer — Document Count Query

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Update the server page to query document counts**

The current `page.tsx` queries projects and profile. Add a document count query after projects are fetched.

Replace the entire content of `src/app/(dashboard)/dashboard/page.tsx` with:

```typescript
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

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

  // Query document counts per project
  const projectIds = (projects || []).map((p) => p.id)
  const documentCounts: Record<string, number> = {}

  if (projectIds.length > 0) {
    const { data: documents } = await supabase
      .from("documents")
      .select("project_id")
      .in("project_id", projectIds)

    documents?.forEach((d) => {
      documentCounts[d.project_id] = (documentCounts[d.project_id] || 0) + 1
    })
  }

  return (
    <DashboardContent
      projects={projects || []}
      user={user}
      profile={profile}
      documentCounts={documentCounts}
    />
  )
}
```

**Step 2: Verify the build compiles (will fail until Task 6 updates DashboardContent)**

This task intentionally breaks the build temporarily. Task 6 will fix it.

**Step 3: Commit (hold until Task 6 completes)**

Commit together with Task 6.

---

### Task 6: Refactor DashboardContent — Wire Everything Together

**Files:**
- Modify: `src/components/dashboard/dashboard-content.tsx`

This is the main refactor task. The 600-line monolithic file becomes ~120 lines.

**Step 1: Rewrite dashboard-content.tsx**

Replace the entire content of `src/components/dashboard/dashboard-content.tsx` with:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import type { Project, Profile } from "@/types/database"
import { signOut } from "@/app/actions/auth"
import { createProject, deleteProject, updateProject } from "@/app/actions/projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  PenLine,
  Plus,
  LogOut,
  Moon,
  Sun,
  Loader2,
  Library,
  Settings,
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CommandPalette } from "@/components/layout/command-palette"
import { GENRES } from "@/lib/genre-colors"
import { DashboardHeader } from "./dashboard-header"
import { ProjectGrid } from "./project-grid"
import { ProjectEditDialog } from "./project-edit-dialog"

interface DashboardContentProps {
  projects: Project[]
  user: User
  profile: Profile | null
  documentCounts: Record<string, number>
}

export function DashboardContent({
  projects: initialProjects,
  user,
  profile,
  documentCounts,
}: DashboardContentProps) {
  const [projects, setProjects] = useState(initialProjects)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  async function handleCreateProject(formData: FormData) {
    setLoading(true)
    const result = await createProject(formData)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setProjects([result.data, ...projects])
      setNewProjectOpen(false)
      toast.success("项目创建成功！")
      router.push(`/editor/${result.data.id}`)
    }
    setLoading(false)
  }

  async function handleDeleteProject() {
    if (!projectToDelete) return
    setLoading(true)
    const result = await deleteProject(projectToDelete.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      setProjects(projects.filter((p) => p.id !== projectToDelete.id))
      toast.success("项目已删除")
    }
    setProjectToDelete(null)
    setDeleteDialogOpen(false)
    setLoading(false)
  }

  async function handleEditProject(projectId: string, formData: FormData) {
    setLoading(true)
    const result = await updateProject(projectId, formData)
    if (result.error) {
      toast.error("更新项目信息失败，请稍后重试")
    } else {
      const title = formData.get("title") as string
      const description = formData.get("description") as string
      const genre = formData.get("genre") as string
      setProjects(
        projects
          .map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  title,
                  description: description || null,
                  genre: genre || null,
                  updated_at: new Date().toISOString(),
                }
              : p
          )
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      )
      toast.success("项目信息已更新")
      setEditDialogOpen(false)
      setProjectToEdit(null)
    }
    setLoading(false)
  }

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user.email?.[0]?.toUpperCase() || "写"

  return (
    <div className="min-h-screen bg-background">
      <CommandPalette onNewProject={() => setNewProjectOpen(true)} />

      {/* Top Nav — unchanged */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <PenLine className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">WriteTeam</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">切换主题</span>
            </Button>
            <Link href="/series">
              <Button variant="ghost" size="icon">
                <Library className="h-5 w-5" />
                <span className="sr-only">系列管理</span>
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-2 p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">
                      {profile?.full_name || "作者"}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    设置
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-5 py-10">
        <DashboardHeader
          projectCount={projects.length}
          onNewProject={() => setNewProjectOpen(true)}
        />

        {/* New Project Dialog */}
        <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
          <DialogContent>
            <form action={handleCreateProject}>
              <DialogHeader>
                <DialogTitle>创建新项目</DialogTitle>
                <DialogDescription>
                  创建新的写作项目，后续可随时修改这些信息。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">标题</Label>
                  <Input id="title" name="title" placeholder="我的精彩小说" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">简介</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="简要描述你的项目..."
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="genre">题材</Label>
                  <Select name="genre">
                    <SelectTrigger>
                      <SelectValue placeholder="选择题材" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  创建项目
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ProjectGrid
          projects={projects}
          documentCounts={documentCounts}
          onEdit={(project) => {
            setProjectToEdit(project)
            setEditDialogOpen(true)
          }}
          onDelete={(project) => {
            setProjectToDelete(project)
            setDeleteDialogOpen(true)
          }}
          onNewProject={() => setNewProjectOpen(true)}
          loading={loading}
        />
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目？</AlertDialogTitle>
            <AlertDialogDescription>
              这将永久删除&ldquo;{projectToDelete?.title}&rdquo;及其全部内容，且无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Project Dialog (merged — replaces old rename + edit dialogs) */}
      <ProjectEditDialog
        project={projectToEdit}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) setProjectToEdit(null)
        }}
        onSave={handleEditProject}
      />
    </div>
  )
}
```

**Key changes from original:**
- Removed: `renameDialogOpen`, `projectToRename`, `renameTitle` states
- Removed: `editTitle`, `editDescription`, `editGenre` states (moved into `ProjectEditDialog`)
- Removed: `handleRenameProject()` function (25 lines)
- Removed: entire Rename Dialog JSX (40 lines)
- Removed: entire Edit Dialog JSX (60 lines) — replaced by `<ProjectEditDialog />`
- Removed: inline project card rendering — replaced by `<ProjectGrid />`
- Removed: header section — replaced by `<DashboardHeader />`
- Changed: `handleEditProject()` now receives `(projectId, formData)` instead of using component-level state
- Added: `documentCounts` prop
- Changed: `GENRES` imported from `@/lib/genre-colors` instead of local constant
- Removed: `FileEdit`, `PenLine` (from card), `MoreVertical`, `Trash2`, `BookOpen` icon imports (moved to sub-components)

**Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Run all dashboard tests**

Run: `npx vitest run src/components/dashboard/ src/lib/genre-colors.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx src/components/dashboard/dashboard-content.tsx
git commit -m "refactor(dashboard): decompose monolithic component, merge duplicate dialogs

- Split 600-line dashboard-content into 5 focused components
- Merge rename + edit dialogs into single ProjectEditDialog
- Add genre-based gradient card covers
- Add document count display on project cards
- Remove 6 redundant state variables and ~120 lines of duplicate code"
```

---

### Task 7: Final Verification

**Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests PASS

**Step 2: Run ESLint**

Run: `npm run lint`
Expected: No errors

**Step 3: Start dev server and visually verify**

Run: `npm run dev`
Expected: Dashboard loads with gradient cards, merged edit dialog works, no console errors

**Step 4: Verify these specific behaviors:**
- [ ] Project cards show genre-based gradient covers
- [ ] Cards show chapter count (e.g., "奇幻 · 5 章")
- [ ] Cards hover with translateY + shadow animation
- [ ] "更多" menu has only 2 items: 编辑信息, 删除 (no 重命名)
- [ ] 编辑信息 dialog opens pre-filled and saves correctly
- [ ] Empty state still works
- [ ] New project dialog still works
- [ ] Delete confirmation still works
