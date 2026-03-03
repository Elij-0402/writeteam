"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import {
  PenLine,
  Search,
  Plus,
  Settings,
  BookOpen,
  Loader2,
} from "lucide-react"
import type { Project, Document } from "@/types/database"
import { GENRES } from "@/lib/genre-colors"
import { createProject, deleteProject, updateProject } from "@/app/actions/projects"
import { createDocument, deleteDocument, updateDocument } from "@/app/actions/documents"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { ProjectTree } from "./project-tree"
import { ProjectEditDialog } from "@/components/dashboard/project-edit-dialog"
import { NavUser } from "./nav-user"

export interface AppSidebarProps {
  projects: Project[]
  documentsByProject: Record<string, Document[]>
  activeDocumentId: string | null
  userDisplayName: string
  userEmail: string
  onSelectDocument: (projectId: string, documentId: string) => void
  onDocumentsChange?: () => void
}

export function AppSidebar({
  projects,
  documentsByProject,
  activeDocumentId,
  userDisplayName,
  userEmail,
  onSelectDocument,
  onDocumentsChange,
}: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState("")
  const [newProjectGenre, setNewProjectGenre] = useState("")
  const [isPending, startTransition] = useTransition()

  // Edit project dialog state
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // New document dialog state
  const [newDocOpen, setNewDocOpen] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState("")
  const [newDocProjectId, setNewDocProjectId] = useState<string | null>(null)

  // Rename document dialog state
  const [renameDocOpen, setRenameDocOpen] = useState(false)
  const [renameDocId, setRenameDocId] = useState<string | null>(null)
  const [renameDocTitle, setRenameDocTitle] = useState("")

  // Filter projects and documents based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects

    const query = searchQuery.trim().toLowerCase()
    return projects.filter((project) => {
      // Match project title
      if (project.title.toLowerCase().includes(query)) return true
      // Match any document title within the project
      const docs = documentsByProject[project.id] || []
      return docs.some((doc) => doc.title.toLowerCase().includes(query))
    })
  }, [projects, documentsByProject, searchQuery])

  const filteredDocumentsByProject = useMemo(() => {
    if (!searchQuery.trim()) return documentsByProject

    const query = searchQuery.trim().toLowerCase()
    const result: Record<string, Document[]> = {}
    for (const project of filteredProjects) {
      const docs = documentsByProject[project.id] || []
      // If the project title matches, show all its documents
      if (project.title.toLowerCase().includes(query)) {
        result[project.id] = docs
      } else {
        // Otherwise, only show matching documents
        result[project.id] = docs.filter((doc) =>
          doc.title.toLowerCase().includes(query)
        )
      }
    }
    return result
  }, [filteredProjects, documentsByProject, searchQuery])

  function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newProjectTitle.trim()) return

    const formData = new FormData()
    formData.append("title", newProjectTitle.trim())
    const resolvedGenre = newProjectGenre === "none" ? "" : newProjectGenre
    formData.append("genre", resolvedGenre)

    startTransition(async () => {
      await createProject(formData)
      setNewProjectOpen(false)
      setNewProjectTitle("")
      setNewProjectGenre("")
      onDocumentsChange?.()
    })
  }

  function handleDeleteProject(projectId: string) {
    startTransition(async () => {
      await deleteProject(projectId)
      onDocumentsChange?.()
    })
  }

  function openCreateDocumentDialog(projectId: string) {
    setNewDocProjectId(projectId)
    setNewDocTitle("")
    setNewDocOpen(true)
  }

  function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!newDocProjectId) return

    const title = newDocTitle.trim() || "未命名章节"
    const formData = new FormData()
    formData.append("title", title)
    formData.append("documentType", "chapter")

    startTransition(async () => {
      const result = await createDocument(newDocProjectId, formData)
      setNewDocOpen(false)
      setNewDocTitle("")
      setNewDocProjectId(null)
      onDocumentsChange?.()
      // Navigate to editor with the new document
      if (result.data) {
        window.location.href = `/editor/${newDocProjectId}?doc=${result.data.id}`
      }
    })
  }

  function handleDeleteDocument(documentId: string, projectId: string) {
    startTransition(async () => {
      await deleteDocument(documentId, projectId)
      onDocumentsChange?.()
    })
  }

  function openRenameDocumentDialog(doc: Document) {
    setRenameDocId(doc.id)
    setRenameDocTitle(doc.title)
    setRenameDocOpen(true)
  }

  function handleRenameDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!renameDocId) return

    const trimmedTitle = renameDocTitle.trim()
    if (!trimmedTitle) return

    startTransition(async () => {
      await updateDocument(renameDocId, { title: trimmedTitle })
      setRenameDocOpen(false)
      setRenameDocId(null)
      setRenameDocTitle("")
      onDocumentsChange?.()
    })
  }

  function handleEditProject(project: Project) {
    setEditProject(project)
    setEditDialogOpen(true)
  }

  async function handleSaveProject(projectId: string, formData: FormData) {
    await updateProject(projectId, formData)
    setEditDialogOpen(false)
    setEditProject(null)
    onDocumentsChange?.()
  }

  function handleOpenCanvas(projectId: string) {
    window.location.href = `/canvas/${projectId}`
  }

  return (
    <>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <PenLine className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">WriteTeam</span>
                    <span className="truncate text-xs text-muted-foreground">
                      AI 创作助手
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="group-data-[collapsible=icon]:hidden flex flex-col gap-2 px-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索项目或文档..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setNewProjectOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Button>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <ProjectTree
            projects={filteredProjects}
            documentsByProject={filteredDocumentsByProject}
            activeDocumentId={activeDocumentId}
            onSelectDocument={onSelectDocument}
            onCreateDocument={openCreateDocumentDialog}
            onCreateProject={() => setNewProjectOpen(true)}
            onDeleteDocument={handleDeleteDocument}
            onDeleteProject={handleDeleteProject}
            onEditProject={handleEditProject}
            onOpenCanvas={handleOpenCanvas}
            onRenameDocument={openRenameDocumentDialog}
          />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="系列管理">
                <Link href="/series">
                  <BookOpen className="h-4 w-4" />
                  <span>系列管理</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="设置">
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  <span>设置</span>
                </Link>
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
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>新建项目</DialogTitle>
              <DialogDescription>
                创建一个新的写作项目。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-project-title">标题</Label>
                <Input
                  id="new-project-title"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="项目标题"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-project-genre">题材</Label>
                <Select
                  value={newProjectGenre}
                  onValueChange={setNewProjectGenre}
                >
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
              <Button
                type="submit"
                disabled={isPending || !newProjectTitle.trim()}
              >
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <ProjectEditDialog
        project={editProject}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) setEditProject(null)
        }}
        onSave={handleSaveProject}
      />

      {/* New Document Dialog */}
      <Dialog open={newDocOpen} onOpenChange={(open) => {
        if (isPending) return
        setNewDocOpen(open)
        if (!open) {
          setNewDocTitle("")
          setNewDocProjectId(null)
        }
      }}>
        <DialogContent>
          <form onSubmit={handleCreateDocument}>
            <DialogHeader>
              <DialogTitle>新建文档</DialogTitle>
              <DialogDescription>
                为章节起一个标题，留空将使用"未命名章节"。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="请输入章节标题"
                maxLength={120}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewDocOpen(false)
                  setNewDocTitle("")
                  setNewDocProjectId(null)
                }}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Document Dialog */}
      <Dialog open={renameDocOpen} onOpenChange={(open) => {
        if (isPending) return
        setRenameDocOpen(open)
        if (!open) {
          setRenameDocId(null)
          setRenameDocTitle("")
        }
      }}>
        <DialogContent>
          <form onSubmit={handleRenameDocument}>
            <DialogHeader>
              <DialogTitle>重命名文档</DialogTitle>
              <DialogDescription>
                输入新的文档标题，保存后立即生效。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={renameDocTitle}
                onChange={(e) => setRenameDocTitle(e.target.value)}
                placeholder="请输入文档标题"
                maxLength={120}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const form = e.currentTarget.closest("form")
                    form?.requestSubmit()
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRenameDocOpen(false)
                  setRenameDocId(null)
                  setRenameDocTitle("")
                }}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending || !renameDocTitle.trim()}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
