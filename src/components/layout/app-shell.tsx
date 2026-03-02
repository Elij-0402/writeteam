"use client"

import { useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import type { Project, Document } from "@/types/database"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { SiteHeader } from "./site-header"
import { AISidebar } from "./ai-sidebar"

export interface AppShellProps {
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
  documentContent,
  hasStyleSample,
  onInsertToEditor,
}: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [focusMode, setFocusMode] = useState(false)
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false)

  const isEditorPage = pathname?.startsWith("/editor/") ?? false

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
          onInsertToEditor={onInsertToEditor ?? (() => {})}
          hasStyleSample={hasStyleSample ?? false}
        />
      )}
    </SidebarProvider>
  )
}
