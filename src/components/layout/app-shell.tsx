"use client"

import { useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import type { Project, Document } from "@/types/database"
import { deriveShellUXState } from "@/lib/dashboard/shell-ux-state"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { SiteHeader } from "./site-header"
import { AISidebar } from "./ai-sidebar"
import { useEditorContext } from "@/components/editor/editor-context"

interface AppShellProps {
  projects: Project[]
  documentsByProject: Record<string, Document[]>
  userDisplayName: string
  userEmail: string
  children: React.ReactNode
}

export function AppShell({
  projects,
  documentsByProject,
  userDisplayName,
  userEmail,
  children,
}: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const editorCtx = useEditorContext()

  const [focusMode, setFocusMode] = useState(false)
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false)

  const isEditorPage = pathname?.startsWith("/editor/") ?? false
  const isDashboardPage = pathname === "/dashboard"

  // Read editor state from context
  const activeProjectId = editorCtx?.activeProjectId ?? undefined
  const activeProjectTitle = editorCtx?.activeProjectTitle ?? undefined
  const activeDocumentId = editorCtx?.activeDocumentId ?? undefined
  const activeDocumentTitle = editorCtx?.activeDocumentTitle ?? undefined
  const wordCount = editorCtx?.wordCount
  const documentContent = editorCtx?.documentContent ?? ""
  const hasStyleSample = editorCtx?.hasStyleSample ?? false
  const characters = editorCtx?.characters ?? []

  const shellProjects = projects.map((project) => ({
    projectId: project.id,
    documents: (documentsByProject[project.id] ?? []).map((document) => ({
      id: document.id,
      title: document.title,
      updatedAt: document.updated_at,
    })),
  }))

  const shellContextState = deriveShellUXState(shellProjects, activeDocumentId)
  const defaultContextStatus = activeDocumentTitle ? "resumable" : "unselected"

  const dashboardContextStatusLabel =
    shellContextState.recommendedNextAction === "create_project"
      ? "下一步：创建项目"
      : shellContextState.recommendedNextAction === "create_first_document"
        ? "下一步：创建首个文档"
        : shellContextState.recommendedNextAction === "continue_current_document"
          ? "下一步：继续当前文档"
          : "下一步：继续最近文档"

  const contextStatus = isDashboardPage
    ? shellContextState.recommendedNextAction === "create_project" ||
      shellContextState.recommendedNextAction === "create_first_document"
      ? "unselected"
      : "resumable"
    : defaultContextStatus

  const contextStatusLabel = isDashboardPage ? dashboardContextStatusLabel : undefined

  const handleInsertToEditor = useCallback((text: string) => {
    editorCtx?.insertTextRef.current?.(text)
  }, [editorCtx])

  const handleSelectDocument = useCallback(
    (projectId: string, documentId: string) => {
      router.push(`/editor/${projectId}?doc=${documentId}`)
    },
    [router]
  )

  const handleToggleFocusMode = useCallback(() => {
    setFocusMode((prev) => !prev)
  }, [])

  const handleToggleAISidebar = useCallback(() => {
    setAiSidebarOpen((prev) => !prev)
  }, [])

  // Focus mode: skip SidebarProvider entirely
  if (focusMode) {
    return (
      <div className="flex h-screen flex-col">
        <SiteHeader
          projectTitle={activeProjectTitle}
          projectId={activeProjectId}
          documentTitle={activeDocumentTitle}
          contextStatus={contextStatus}
          contextStatusLabel={contextStatusLabel}
          wordCount={wordCount}
          focusMode={focusMode}
          onToggleFocusMode={handleToggleFocusMode}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    )
  }

  // Normal mode: full sidebar layout
  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <AppSidebar
        projects={projects}
        documentsByProject={documentsByProject}
        activeDocumentId={activeDocumentId ?? null}
        userDisplayName={userDisplayName}
        userEmail={userEmail}
        onSelectDocument={handleSelectDocument}
      />
      <SidebarInset>
        <SiteHeader
          projectTitle={activeProjectTitle}
          projectId={activeProjectId}
          documentTitle={activeDocumentTitle}
          contextStatus={contextStatus}
          contextStatusLabel={contextStatusLabel}
          wordCount={wordCount}
          focusMode={focusMode}
          onToggleFocusMode={isEditorPage ? handleToggleFocusMode : undefined}
          aiSidebarOpen={aiSidebarOpen}
          onToggleAISidebar={isEditorPage ? handleToggleAISidebar : undefined}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </SidebarInset>
      {/* Right AI sidebar - only when in editor mode and toggled open */}
      {isEditorPage && aiSidebarOpen && activeProjectId && (
        <AISidebar
          projectId={activeProjectId}
          documentId={activeDocumentId ?? null}
          documentContent={documentContent ?? ""}
          onInsertToEditor={handleInsertToEditor}
          hasStyleSample={hasStyleSample ?? false}
          characters={characters}
        />
      )}
    </SidebarProvider>
  )
}
