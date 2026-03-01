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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  MoreVertical,
  Trash2,
  BookOpen,
  LogOut,
  Moon,
  Sun,
  Loader2,
  Library,
  Settings,
  FileEdit,
} from "lucide-react"
import { useTheme } from "next-themes"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CommandPalette } from "@/components/layout/command-palette"

const GENRES = [
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
]

interface DashboardContentProps {
  projects: Project[]
  user: User
  profile: Profile | null
}

export function DashboardContent({
  projects: initialProjects,
  user,
  profile,
}: DashboardContentProps) {
  const [projects, setProjects] = useState(initialProjects)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [projectToRename, setProjectToRename] = useState<Project | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editGenre, setEditGenre] = useState("")
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

  async function handleRenameProject() {
    if (!projectToRename || !renameTitle.trim()) return
    setLoading(true)
    const formData = new FormData()
    formData.append("title", renameTitle.trim())
    formData.append("description", projectToRename.description || "")
    formData.append("genre", projectToRename.genre || "")
    const result = await updateProject(projectToRename.id, formData)
    if (result.error) {
      toast.error("重命名失败，请稍后重试")
    } else {
      setProjects(
        projects
          .map((p) =>
            p.id === projectToRename.id
              ? { ...p, title: renameTitle.trim(), updated_at: new Date().toISOString() }
              : p
          )
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      )
      toast.success("项目已重命名")
      setRenameDialogOpen(false)
      setProjectToRename(null)
      setRenameTitle("")
    }
    setLoading(false)
  }

  async function handleEditProject() {
    if (!projectToEdit || !editTitle.trim()) return
    setLoading(true)
    const resolvedGenre = editGenre === "none" ? "" : editGenre
    const formData = new FormData()
    formData.append("title", editTitle.trim())
    formData.append("description", editDescription)
    formData.append("genre", resolvedGenre)
    const result = await updateProject(projectToEdit.id, formData)
    if (result.error) {
      toast.error("更新项目信息失败，请稍后重试")
    } else {
      setProjects(
        projects
          .map((p) =>
            p.id === projectToEdit.id
              ? {
                  ...p,
                  title: editTitle.trim(),
                  description: editDescription || null,
                  genre: resolvedGenre || null,
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
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                >
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
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
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
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">我的项目</h1>
            <p className="mt-1 text-muted-foreground">
              {projects.length} 个项目
            </p>
          </div>
          <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新建项目
              </Button>
            </DialogTrigger>
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
                    <Input
                      id="title"
                      name="title"
                      placeholder="我的精彩小说"
                      required
                    />
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
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    创建项目
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Project Grid */}
        {projects.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">还没有项目</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              创建你的第一个项目，开始写作
            </p>
            <Button onClick={() => setNewProjectOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="group relative transition-shadow hover:shadow-md"
              >
                <Link href={`/editor/${project.id}`} className="absolute inset-0 z-10" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg leading-tight">
                      {project.title}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="relative z-20 h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation()
                            setProjectToRename(project)
                            setRenameTitle(project.title)
                            setRenameDialogOpen(true)
                          }}
                        >
                          <PenLine className="mr-2 h-4 w-4" />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation()
                            setProjectToEdit(project)
                            setEditTitle(project.title)
                            setEditDescription(project.description || "")
                            setEditGenre(project.genre || "")
                            setEditDialogOpen(true)
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
                            setProjectToDelete(project)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {project.genre && (
                    <CardDescription>
                      {project.genre}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
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
            ))}
          </div>
        )}
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

      {/* Rename Dialog */}
      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open)
          if (!open) {
            setProjectToRename(null)
            setRenameTitle("")
          }
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleRenameProject() }}>
            <DialogHeader>
              <DialogTitle>重命名项目</DialogTitle>
              <DialogDescription>
                输入新的项目标题。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rename-title">标题</Label>
                <Input
                  id="rename-title"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  placeholder="项目标题"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={loading || !renameTitle.trim()}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Info Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setProjectToEdit(null)
            setEditTitle("")
            setEditDescription("")
            setEditGenre("")
          }
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleEditProject() }}>
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
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="项目标题"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">简介</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="简要描述你的项目..."
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-genre">题材</Label>
                <Select value={editGenre} onValueChange={setEditGenre}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择题材" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不设置题材</SelectItem>
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
              <Button
                type="submit"
                disabled={loading || !editTitle.trim()}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
