"use client"

import { useMemo, useState } from "react"
import {
  ChevronRight,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  LayoutGrid,
} from "lucide-react"
import type { Project, Document } from "@/types/database"
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
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface ProjectTreeProps {
  projects: Project[]
  documentsByProject: Record<string, Document[]>
  activeDocumentId: string | null
  onSelectDocument: (projectId: string, documentId: string) => void
  onCreateDocument?: (projectId: string) => void
  onCreateProject?: () => void
  onDeleteDocument?: (documentId: string, projectId: string) => void
  onDeleteProject?: (projectId: string) => void
  onEditProject?: (project: Project) => void
  onOpenCanvas?: (projectId: string) => void
  onRenameDocument?: (document: Document) => void
}

export function ProjectTree({
  projects,
  documentsByProject,
  activeDocumentId,
  onSelectDocument,
  onCreateDocument,
  onCreateProject,
  onDeleteDocument,
  onDeleteProject,
  onEditProject,
  onOpenCanvas,
  onRenameDocument,
}: ProjectTreeProps) {
  // Determine which project contains the active document
  const activeProjectId = useMemo(() => {
    if (!activeDocumentId) return null
    for (const [projectId, docs] of Object.entries(documentsByProject)) {
      if (docs.some((d) => d.id === activeDocumentId)) {
        return projectId
      }
    }
    return null
  }, [activeDocumentId, documentsByProject])

  // Track open state for each project collapsible
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({})

  function isProjectOpen(projectId: string) {
    if (projectId in openProjects) {
      return openProjects[projectId]
    }
    // Auto-expand project containing the active document
    return projectId === activeProjectId
  }

  function setProjectOpen(projectId: string, open: boolean) {
    setOpenProjects((prev) => ({ ...prev, [projectId]: open }))
  }

  if (projects.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-4 py-8 text-center">
            <FolderOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">还没有项目</p>
            {onCreateProject && (
              <button
                onClick={onCreateProject}
                className="mt-2 text-sm text-primary hover:underline"
              >
                创建第一个项目
              </button>
            )}
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
            return (
              <Collapsible
                key={project.id}
                open={isProjectOpen(project.id)}
                onOpenChange={(open) => setProjectOpen(project.id, open)}
                asChild
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={project.title}>
                      <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      <span>{project.title}</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <MoreHorizontal />
                        <span className="sr-only">项目菜单</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="right">
                      {onCreateDocument && (
                        <DropdownMenuItem
                          onClick={() => onCreateDocument(project.id)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          新建文档
                        </DropdownMenuItem>
                      )}
                      {onEditProject && (
                        <DropdownMenuItem
                          onClick={() => onEditProject(project)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑项目
                        </DropdownMenuItem>
                      )}
                      {onOpenCanvas && (
                        <DropdownMenuItem
                          onClick={() => onOpenCanvas(project.id)}
                        >
                          <LayoutGrid className="mr-2 h-4 w-4" />
                          Canvas
                        </DropdownMenuItem>
                      )}
                      {onDeleteProject && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeleteProject(project.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除项目
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {docs.map((doc, docIndex) => (
                        <SidebarMenuSubItem key={doc.id} className="group/doc relative">
                          <SidebarMenuSubButton
                            isActive={doc.id === activeDocumentId}
                            onClick={() =>
                              onSelectDocument(project.id, doc.id)
                            }
                          >
                            <FileText className="h-4 w-4" />
                            <span>{docIndex + 1}. {doc.title}</span>
                          </SidebarMenuSubButton>
                          {(onRenameDocument || onDeleteDocument) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/doc:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent text-muted-foreground"
                                  aria-label={`文档菜单 ${doc.title}`}
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" side="right">
                                {onRenameDocument && (
                                  <DropdownMenuItem onClick={() => onRenameDocument(doc)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    重命名
                                  </DropdownMenuItem>
                                )}
                                {onDeleteDocument && (
                                  <DropdownMenuItem
                                    onClick={() => onDeleteDocument(doc.id, project.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </SidebarMenuSubItem>
                      ))}
                      {docs.length === 0 && (
                        <SidebarMenuSubItem>
                          <span className="px-2 py-1 text-xs text-muted-foreground">
                            暂无文档
                          </span>
                        </SidebarMenuSubItem>
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
