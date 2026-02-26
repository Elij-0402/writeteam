"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { Json, Plugin } from "@/types/database"
import Link from "next/link"
import type { Project, Document, StoryBible, Character } from "@/types/database"
import { createDocument, updateDocument, deleteDocument } from "@/app/actions/documents"
import { WritingEditor } from "@/components/editor/writing-editor"
import { StoryBiblePanel } from "@/components/story-bible/story-bible-panel"
import { AIChatPanel } from "@/components/ai/ai-chat-panel"
import { AIToolbar } from "@/components/ai/ai-toolbar"
import { MusePanel } from "@/components/ai/muse-panel"
import { VisualizePanel } from "@/components/ai/visualize-panel"
import { PluginManager } from "@/components/plugins/plugin-manager"
import { SaliencyIndicator } from "@/components/editor/saliency-indicator"
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
  Download,
  Upload,
  Lightbulb,
  Image as ImageIcon,
  LayoutGrid,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { exportAsText, exportAsDocx, exportProjectAsDocx } from "@/lib/export"
import { parseImportedFile } from "@/lib/import"
import { computeSaliency } from "@/lib/ai/saliency"
import type { SaliencyMap } from "@/lib/ai/saliency"

interface EditorShellProps {
  project: Project
  documents: Document[]
  storyBible: StoryBible | null
  characters: Character[]
  plugins?: Plugin[]
}

type RightPanelType = "none" | "bible" | "chat" | "muse" | "visualize"

export function EditorShell({
  project,
  documents: initialDocuments,
  storyBible: initialStoryBible,
  characters: initialCharacters,
  plugins: initialPlugins = [],
}: EditorShellProps) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [activeDocId, setActiveDocId] = useState<string | null>(
    initialDocuments[0]?.id || null
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightPanel, setRightPanel] = useState<RightPanelType>("none")
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [editorContent, setEditorContent] = useState("")
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false)
  const [plugins, setPlugins] = useState(initialPlugins)
  const [saliencyMap, setSaliencyMap] = useState<SaliencyMap | null>(null)
  const [saliencyLoading, setSaliencyLoading] = useState(false)
  const saliencyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeDocument = documents.find((d) => d.id === activeDocId) || null
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Compute saliency debounced whenever document content changes
  useEffect(() => {
    if (!activeDocument?.content_text) {
      return
    }

    if (saliencyTimeoutRef.current) {
      clearTimeout(saliencyTimeoutRef.current)
    }

    saliencyTimeoutRef.current = setTimeout(() => {
      setSaliencyLoading(true)
      const charInfos = initialCharacters.map((c) => ({
        name: c.name,
        role: c.role,
      }))
      const result = computeSaliency(
        activeDocument.content_text || "",
        charInfos,
        initialStoryBible?.setting,
        initialStoryBible?.worldbuilding
      )
      setSaliencyMap(result)
      setSaliencyLoading(false)
    }, 5000)

    return () => {
      if (saliencyTimeoutRef.current) {
        clearTimeout(saliencyTimeoutRef.current)
      }
    }
  }, [activeDocument?.content_text, initialCharacters, initialStoryBible?.setting, initialStoryBible?.worldbuilding])

  const handleExportTxt = useCallback(() => {
    if (!activeDocument) return
    exportAsText(activeDocument.title, activeDocument.content_text || "")
    toast.success("已导出为 .txt")
  }, [activeDocument])

  const handleExportDocx = useCallback(async () => {
    if (!activeDocument) return
    await exportAsDocx(activeDocument.title, activeDocument.content_text || "")
    toast.success("已导出为 .docx")
  }, [activeDocument])

  const handleExportProject = useCallback(async () => {
    if (documents.length === 0) return
    const chapters = documents.map((doc) => ({
      title: doc.title,
      content: doc.content_text || "",
    }))
    await exportProjectAsDocx(project.title, chapters)
    toast.success("已导出整个项目")
  }, [documents, project.title])

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const { title, content } = await parseImportedFile(file)
        const formData = new FormData()
        formData.set("title", title)
        formData.set("documentType", "chapter")
        const result = await createDocument(project.id, formData)
        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          await updateDocument(result.data.id, {
            content_text: content,
            word_count: content.length,
          })
          const newDoc = { ...result.data, content_text: content, word_count: content.length }
          setDocuments((prev) => [...prev, newDoc])
          setActiveDocId(result.data.id)
          toast.success("文件已导入")
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "导入失败")
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [project.id]
  )

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
      setEditorContent(text)
    },
    []
  )

  const toggleRightPanel = useCallback((panel: RightPanelType) => {
    setRightPanel((current) => current === panel ? "none" : panel)
  }, [])

  const totalWordCount = documents.reduce((sum, d) => sum + (d.word_count || 0), 0)

  const renderEditorArea = () => (
    <div className="flex h-full flex-col">
      {activeDocument && (
        <>
          <AIToolbar
            selectedText={selectedText}
            documentContent={activeDocument.content_text || ""}
            projectId={project.id}
            documentId={activeDocument.id}
            onInsertText={handleInsertText}
            plugins={plugins}
            preferredModel={project.preferred_model}
            onToggleMuse={() => toggleRightPanel("muse")}
            onToggleVisualizePanel={() => toggleRightPanel("visualize")}
            onOpenPluginManager={() => setPluginManagerOpen(true)}
            saliencyData={saliencyMap}
          />
          <WritingEditor
            document={activeDocument}
            projectId={project.id}
            onUpdate={handleDocumentUpdate}
            onSelectionChange={setSelectedText}
            insertContent={editorContent}
          />
          <SaliencyIndicator
            saliencyMap={saliencyMap}
            loading={saliencyLoading}
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
  )

  const renderRightPanel = () => {
    switch (rightPanel) {
      case "bible":
        return (
          <StoryBiblePanel
            projectId={project.id}
            storyBible={initialStoryBible}
            characters={initialCharacters}
          />
        )
      case "chat":
        return (
          <AIChatPanel
            projectId={project.id}
            documentContent={activeDocument?.content_text || ""}
          />
        )
      case "muse":
        return (
          <MusePanel
            projectId={project.id}
            documentContent={activeDocument?.content_text || ""}
            onUseAsDirection={(text) => handleInsertText(text)}
          />
        )
      case "visualize":
        return (
          <VisualizePanel
            projectId={project.id}
            selectedText={selectedText}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <CommandPalette
        onToggleStoryBible={() => toggleRightPanel("bible")}
        onToggleChat={() => toggleRightPanel("chat")}
        onToggleMuse={() => toggleRightPanel("muse")}
        onNavigateCanvas={() => {
          window.location.href = `/canvas/${project.id}`
        }}
      />
      <PluginManager
        open={pluginManagerOpen}
        onOpenChange={setPluginManagerOpen}
        projectId={project.id}
        plugins={plugins}
        onPluginsChange={setPlugins}
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
          {/* Canvas Link */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={`/canvas/${project.id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>故事画布</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={rightPanel === "bible" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleRightPanel("bible")}
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
                onClick={() => toggleRightPanel("chat")}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI 对话</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={rightPanel === "muse" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleRightPanel("muse")}
              >
                <Lightbulb className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>灵感伙伴</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={rightPanel === "visualize" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleRightPanel("visualize")}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>可视化</TooltipContent>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      disabled={!activeDocument && documents.length === 0}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      导出文档
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={handleExportTxt}
                      disabled={!activeDocument}
                    >
                      导出为 .txt
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleExportDocx}
                      disabled={!activeDocument}
                    >
                      导出为 .docx
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleExportProject}
                      disabled={documents.length === 0}
                    >
                      导出整个项目
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  导入文件
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.docx"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>
            </>
          )}
        </div>

        {/* Editor + Right Panel */}
        {rightPanel !== "none" ? (
          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            <ResizablePanel defaultSize={65} minSize={40}>
              {renderEditorArea()}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={25}>
              {renderRightPanel()}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex flex-1 flex-col">
            {renderEditorArea()}
          </div>
        )}
      </div>
    </div>
  )
}
