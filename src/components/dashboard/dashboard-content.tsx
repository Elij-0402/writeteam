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

      {/* Top Nav */}
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
        key={projectToEdit?.id ?? "none"}
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
