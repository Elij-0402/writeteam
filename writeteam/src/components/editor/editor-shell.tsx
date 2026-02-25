"use client"

import { useState, useCallback } from "react"
import type { Json } from "@/types/database"
import Link from "next/link"
import type { Project, Document, StoryBible, Character } from "@/types/database"
import { createDocument, updateDocument, deleteDocument } from "@/app/actions/documents"
import { WritingEditor } from "@/components/editor/writing-editor"
import { StoryBiblePanel } from "@/components/story-bible/story-bible-panel"
import { AIChatPanel } from "@/components/ai/ai-chat-panel"
import { AIToolbar } from "@/components/ai/ai-toolbar"
import { CommandPalette } from "@/components/layout/command-palette"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PenLine,
  ArrowLeft,
  Plus,
  FileText,
  BookOpen,
  MessageSquare,
  MoreVertical,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface EditorShellProps {
  project: Project
  documents: Document[]
  storyBible: StoryBible | null
  characters: Character[]
}

export function EditorShell({
  project,
  documents: initialDocuments,
  storyBible: initialStoryBible,
  characters: initialCharacters,
}: EditorShellProps) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [activeDocId, setActiveDocId] = useState<string | null>(
    initialDocuments[0]?.id || null
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightPanel, setRightPanel] = useState<"none" | "bible" | "chat">("none")
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [editorContent, setEditorContent] = useState("")

  const activeDocument = documents.find((d) => d.id === activeDocId) || null

  const handleCreateDocument = useCallback(async () => {
    setCreatingDoc(true)
    const formData = new FormData()
    formData.set("title", `第 ${documents.length + 1} 章`)
    formData.set("documentType", "chapter")
    const result = await createDocument(project.id, formData)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setDocuments((prev) => [...prev, result.data!])
      setActiveDocId(result.data.id)
      toast.success("文档已创建")
    }
    setCreatingDoc(false)
  }, [documents.length, project.id])

  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      const result = await deleteDocument(docId, project.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        setDocuments((prev) => prev.filter((d) => d.id !== docId))
        if (activeDocId === docId) {
          const remaining = documents.filter((d) => d.id !== docId)
          setActiveDocId(remaining[0]?.id || null)
        }
        toast.success("文档已删除")
      }
    },
    [activeDocId, documents, project.id]
  )

  const handleDocumentUpdate = useCallback(
    async (docId: string, updates: { content?: Json | null; content_text?: string; word_count?: number }) => {
      await updateDocument(docId, updates)
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, ...updates, updated_at: new Date().toISOString() } : d))
      )
    },
    []
  )

  const handleInsertText = useCallback(
    (text: string) => {
      // This will be handled by the editor via a ref/callback pattern
      setEditorContent(text)
    },
    []
  )

  const totalWordCount = documents.reduce((sum, d) => sum + (d.word_count || 0), 0)

  return (
    <div className="flex h-screen flex-col bg-background">
      <CommandPalette
        onToggleStoryBible={() => setRightPanel(rightPanel === "bible" ? "none" : "bible")}
        onToggleChat={() => setRightPanel(rightPanel === "chat" ? "none" : "chat")}
      />
      {/* Top Bar */}
      <header className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>返回项目面板</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{project.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {totalWordCount.toLocaleString()} 字
          </span>
          <Separator orientation="vertical" className="h-6" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={rightPanel === "bible" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setRightPanel(rightPanel === "bible" ? "none" : "bible")
                }
              >
                <BookOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>故事圣经</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={rightPanel === "chat" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setRightPanel(rightPanel === "chat" ? "none" : "chat")
                }
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI 对话</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Document List */}
        <div
          className={cn(
            "flex flex-col border-r transition-all duration-200",
            sidebarCollapsed ? "w-12" : "w-60"
          )}
        >
          <div className="flex h-10 items-center justify-between px-2">
            {!sidebarCollapsed && (
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                文档
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          {!sidebarCollapsed && (
            <>
              <ScrollArea className="flex-1 px-2">
                <div className="space-y-1 pb-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={cn(
                        "group flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm transition-colors",
                        activeDocId === doc.id
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                      onClick={() => setActiveDocId(doc.id)}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{doc.title}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteDocument(doc.id)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleCreateDocument}
                  disabled={creatingDoc}
                >
                  {creatingDoc ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  新建文档
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Editor + Right Panel */}
        {rightPanel !== "none" ? (
          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            <ResizablePanel defaultSize={65} minSize={40}>
              <div className="flex h-full flex-col">
                {activeDocument && (
                  <>
                    <AIToolbar
                      selectedText={selectedText}
                      documentContent={activeDocument.content_text || ""}
                      projectId={project.id}
                      documentId={activeDocument.id}
                      onInsertText={handleInsertText}
                    />
                    <WritingEditor
                      document={activeDocument}
                      onUpdate={handleDocumentUpdate}
                      onSelectionChange={setSelectedText}
                      insertContent={editorContent}
                    />
                  </>
                )}
                {!activeDocument && (
                  <div className="flex flex-1 items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>请选择或创建文档后开始写作</p>
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={25}>
              {rightPanel === "bible" && (
                <StoryBiblePanel
                  projectId={project.id}
                  storyBible={initialStoryBible}
                  characters={initialCharacters}
                />
              )}
              {rightPanel === "chat" && (
                <AIChatPanel
                  projectId={project.id}
                  documentContent={activeDocument?.content_text || ""}
                />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex flex-1 flex-col">
            {activeDocument && (
              <>
                <AIToolbar
                  selectedText={selectedText}
                  documentContent={activeDocument.content_text || ""}
                  projectId={project.id}
                  documentId={activeDocument.id}
                  onInsertText={handleInsertText}
                />
                <WritingEditor
                  document={activeDocument}
                  onUpdate={handleDocumentUpdate}
                  onSelectionChange={setSelectedText}
                  insertContent={editorContent}
                />
              </>
            )}
            {!activeDocument && (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>请选择或创建文档后开始写作</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
