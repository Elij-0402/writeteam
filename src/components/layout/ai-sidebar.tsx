"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { AIChatPanel } from "@/components/ai/ai-chat-panel"
import type { Character } from "@/types/database"

export interface AISidebarProps {
  projectId: string
  documentId: string | null
  documentContent: string
  onInsertToEditor: (text: string) => void
  hasStyleSample: boolean
  characters?: Character[]
}

export function AISidebar({
  projectId,
  documentId,
  documentContent,
  onInsertToEditor,
  hasStyleSample,
  characters = [],
}: AISidebarProps) {
  return (
    <Sidebar side="right" collapsible="offcanvas" className="border-l">
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
          characters={characters}
        />
      </SidebarContent>
    </Sidebar>
  )
}
