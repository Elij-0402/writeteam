"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import type { Json, Plugin } from "@/types/database"
import Link from "next/link"
import type { Project, Document, StoryBible, Character } from "@/types/database"
import { createDocument, updateDocument, deleteDocument, reorderDocuments } from "@/app/actions/documents"
import { WritingEditor } from "@/components/editor/writing-editor"
import { SaveStatusBanner } from "@/components/editor/save-status-banner"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  PenLine,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
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
  Settings,
  Check,
  ChevronsUpDown,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AIProviderForm } from "@/components/settings/ai-provider-form"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"
import type { AIProviderConfig } from "@/lib/ai/ai-config"
import { exportAsText, exportAsDocx, exportProjectAsDocx } from "@/lib/export"
import { parseImportedFile } from "@/lib/import"
import { computeSaliency } from "@/lib/ai/saliency"
import type { SaliencyMap } from "@/lib/ai/saliency"
import { countDocumentWords } from "@/lib/text-stats"
import { readEditorSessionState, writeEditorSessionState } from "@/components/editor/editor-session-state"
import type { AutosaveStatus } from "@/components/editor/autosave-status"
import {
  getDocumentProgressTag,
  isDocumentRecentlyEdited,
  type DocumentProgressTag,
} from "@/lib/editor/document-progress"
import { isEditorFocusEnhancementEnabled } from "@/lib/editor/editor-experience-flags"

const documentProgressTagMeta: Record<DocumentProgressTag, { label: string; className: string }> = {
  unfinished: {
    label: "未完成",
    className: "text-amber-700",
  },
  drafting: {
    label: "草稿中",
    className: "text-blue-700",
  },
  stable: {
    label: "已成稿",
    className: "text-emerald-700",
  },
}

interface EditorShellProps {
  project: Project
  documents: Document[]
  storyBible: StoryBible | null
  characters: Character[]
  plugins?: Plugin[]
  entryContext?: {
    source: "canvas"
    nodeId: string
    nodeLabel: string
    nodeType: string
    nodeSummary: string
  } | null
}

type RightPanelType = "none" | "bible" | "chat" | "muse" | "visualize"

function buildTiptapDocFromText(text: string): Json {
  const normalized = text.replace(/\r\n/g, "\n")
  const lines = normalized.split("\n")
  const paragraphs = lines.map((line) => ({
    type: "paragraph",
    content: line.length > 0 ? [{ type: "text", text: line }] : undefined,
  }))

  const content = paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }]

  return {
    type: "doc",
    content,
  }
}

export function EditorShell({
  project,
  documents: initialDocuments,
  storyBible: initialStoryBible,
  characters: initialCharacters,
  plugins: initialPlugins = [],
  entryContext = null,
}: EditorShellProps) {
  const focusEnhancementEnabled = isEditorFocusEnhancementEnabled()
  const [documents, setDocuments] = useState(initialDocuments)
  const [activeDocId, setActiveDocId] = useState<string | null>(
    initialDocuments[0]?.id || null
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [sessionHydrated, setSessionHydrated] = useState(false)
  const [rightPanel, setRightPanel] = useState<RightPanelType>("none")
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [editorContent, setEditorContent] = useState("")
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false)
  const [plugins, setPlugins] = useState(initialPlugins)
  const [saliencyMap, setSaliencyMap] = useState<SaliencyMap | null>(null)
  const [saliencyLoading, setSaliencyLoading] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [reorderingDocId, setReorderingDocId] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameDocId, setRenameDocId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [renameSubmitting, setRenameSubmitting] = useState(false)
  const [showEntryHint, setShowEntryHint] = useState(true)
  const [aiConfigOpen, setAiConfigOpen] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle")
  const [autosaveRetryRequestId, setAutosaveRetryRequestId] = useState(0)
  const [switcherModels, setSwitcherModels] = useState<Array<{ id: string; name: string }>>([])
  const [switcherLoading, setSwitcherLoading] = useState(false)
  const [switcherSearch, setSwitcherSearch] = useState("")
  const saliencyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const switcherAbortRef = useRef<AbortController | null>(null)
  const { config: aiConfig, isConfigured: aiConfigured, updateConfig } = useAIConfigContext()

  const handleSwitcherOpen = useCallback(async (open: boolean) => {
    setAiConfigOpen(open)
    if (!open || !aiConfigured || !aiConfig) {
      switcherAbortRef.current?.abort()
      return
    }
    switcherAbortRef.current?.abort()
    const controller = new AbortController()
    switcherAbortRef.current = controller
    setSwitcherLoading(true)
    setSwitcherSearch("")
    try {
      const response = await fetch("/api/ai/models", {
        headers: {
          "X-AI-Base-URL": aiConfig.baseUrl,
          "X-AI-API-Key": aiConfig.apiKey,
          "X-AI-Model-ID": aiConfig.modelId,
        },
        signal: controller.signal,
      })
      if (response.ok) {
        const data = await response.json()
        setSwitcherModels(data.models || [])
      }
    } catch {
      // silent — includes AbortError when popover closes quickly
    } finally {
      if (!controller.signal.aborted) {
        setSwitcherLoading(false)
      }
    }
  }, [aiConfigured, aiConfig])

  const handleModelSwitch = useCallback((modelId: string, modelName: string) => {
    if (!aiConfig) return
    const updated: AIProviderConfig = {
      ...aiConfig,
      modelId,
      modelName: modelName || modelId,
      configuredAt: Date.now(),
    }
    updateConfig(updated)
    setAiConfigOpen(false)
    toast.success(`已切换到 ${modelName || modelId}`)
  }, [aiConfig, updateConfig])

  const activeDocument = documents.find((d) => d.id === activeDocId) || null
  const hasCanvasEntry =
    showEntryHint &&
    entryContext?.source === "canvas" &&
    entryContext.nodeId.trim().length > 0
  const canvasBackHref = hasCanvasEntry
    ? `/canvas/${project.id}?focusNodeId=${encodeURIComponent(entryContext.nodeId)}`
    : `/canvas/${project.id}`
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSessionHydrated(false)
    const sessionState = readEditorSessionState(project.id)
    setFocusMode(sessionState.focusMode)
    setSessionHydrated(true)
  }, [project.id])

  useEffect(() => {
    if (!sessionHydrated) {
      return
    }

    if (!focusEnhancementEnabled) {
      return
    }

    writeEditorSessionState(project.id, { focusMode })
  }, [focusEnhancementEnabled, focusMode, project.id, sessionHydrated])

  useEffect(() => {
    if (focusEnhancementEnabled) {
      return
    }

    setFocusMode(false)
  }, [focusEnhancementEnabled])

  const getActionErrorMessage = useCallback((error: unknown, fallbackMessage: string) => {
    if (typeof error === "object" && error && "message" in error) {
      const message = String((error as { message?: unknown }).message ?? "").trim()
      if (message.length > 0) {
        return message
      }
    }

    return fallbackMessage
  }, [])

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
    try {
      exportAsText(`${project.title}-${activeDocument.title}`, activeDocument.content_text || "")
      toast.success("已导出为 .txt")
    } catch (error) {
      toast.error(getActionErrorMessage(error, "导出失败，请稍后重试或改为 .docx"))
    }
  }, [activeDocument, getActionErrorMessage, project.title])

  const handleExportDocx = useCallback(async () => {
    if (!activeDocument) return
    const exportTitle = `${project.title}-${activeDocument.title}`

    try {
      await exportAsDocx(exportTitle, activeDocument.content_text || "")
      toast.success("已导出为 .docx")
      return
    } catch (error) {
      toast.error(getActionErrorMessage(error, "导出 .docx 失败，已尝试导出为 .txt"))
    }

    try {
      exportAsText(exportTitle, activeDocument.content_text || "")
      toast.success("已降级导出为 .txt")
    } catch (fallbackError) {
      toast.error(getActionErrorMessage(fallbackError, "导出失败，请检查浏览器下载权限后重试"))
    }
  }, [activeDocument, getActionErrorMessage, project.title])

  const handleExportProject = useCallback(async () => {
    if (documents.length === 0) return
    try {
      const chapters = documents.map((doc) => ({
        title: doc.title,
        content: doc.content_text || "",
      }))
      await exportProjectAsDocx(project.title, chapters)
      toast.success("已导出整个项目")
    } catch (error) {
      toast.error(getActionErrorMessage(error, "导出项目失败，请稍后重试"))
    }
  }, [documents, getActionErrorMessage, project.title])

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
          const importedWordCount = countDocumentWords(content)
          const importedDoc = buildTiptapDocFromText(content)
          const updateResult = await updateDocument(result.data.id, {
            content: importedDoc,
            content_text: content,
            word_count: importedWordCount,
          })

          if (updateResult.error) {
            setDocuments((prev) => [...prev, result.data!])
            setActiveDocId(result.data.id)
            toast.error("文件已导入，但内容保存失败，请重试")
            return
          }

          const newDoc = {
            ...result.data,
            content: importedDoc,
            content_text: content,
            word_count: importedWordCount,
          }

          setDocuments((prev) => [...prev, newDoc])
          setActiveDocId(result.data.id)
          toast.success("文件已导入")
        }
      } catch (err) {
        toast.error(getActionErrorMessage(err, "导入失败，请检查文件格式或网络后重试"))
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [getActionErrorMessage, project.id]
  )

  const handleCreateDocument = useCallback(async () => {
    setCreatingDoc(true)
    try {
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
    } catch (error) {
      toast.error(getActionErrorMessage(error, "创建失败，请检查网络后重试"))
    } finally {
      setCreatingDoc(false)
    }
  }, [documents.length, getActionErrorMessage, project.id])

  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      setDeletingDocId(docId)
      try {
        const result = await deleteDocument(docId, project.id)
        if (result.error) {
          toast.error(result.error)
        } else {
          setDocuments((prev) => {
            const deletedIndex = prev.findIndex((d) => d.id === docId)
            const remaining = prev.filter((d) => d.id !== docId)

            if (activeDocId === docId) {
              const fallbackDoc = remaining[deletedIndex] || remaining[deletedIndex - 1] || null
              setActiveDocId(fallbackDoc?.id || null)
            }

            return remaining
          })
          toast.success("文档已删除")
        }
      } catch (error) {
        toast.error(getActionErrorMessage(error, "删除失败，请检查网络后重试"))
      } finally {
        setDeletingDocId(null)
      }
    },
    [activeDocId, getActionErrorMessage, project.id]
  )

  const moveDocument = useCallback((list: Document[], docId: string, direction: "up" | "down") => {
    const index = list.findIndex((doc) => doc.id === docId)
    if (index === -1) {
      return list
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= list.length) {
      return list
    }

    const next = [...list]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)

    return next.map((doc, sortOrder) => ({ ...doc, sort_order: sortOrder }))
  }, [])

  const handleReorderDocument = useCallback(
    async (docId: string, direction: "up" | "down") => {
      if (reorderingDocId) {
        return
      }

      const previousDocs = documents
      const reorderedDocs = moveDocument(previousDocs, docId, direction)

      if (reorderedDocs === previousDocs) {
        return
      }

      setReorderingDocId(docId)
      setDocuments(reorderedDocs)
      try {
        const result = await reorderDocuments(
          project.id,
          reorderedDocs.map((doc) => doc.id)
        )

        if (result.error) {
          setDocuments(previousDocs)
          toast.error(result.error)
        } else {
          toast.success("文档顺序已更新")
        }
      } catch (error) {
        setDocuments(previousDocs)
        toast.error(getActionErrorMessage(error, "排序失败，请检查网络后重试"))
      } finally {
        setReorderingDocId(null)
      }
    },
    [documents, getActionErrorMessage, moveDocument, project.id, reorderingDocId]
  )

  const openRenameDialog = useCallback((doc: Document) => {
    setRenameDocId(doc.id)
    setRenameTitle(doc.title)
    setRenameOpen(true)
  }, [])

  const handleRenameDocument = useCallback(async () => {
    if (!renameDocId) {
      return
    }

    const trimmedTitle = renameTitle.trim()
    if (!trimmedTitle) {
      toast.error("标题不能为空")
      return
    }

    setRenameSubmitting(true)
    try {
      const result = await updateDocument(renameDocId, { title: trimmedTitle })

      if (result.error) {
        toast.error(result.error)
        return
      }

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === renameDocId
            ? { ...doc, title: trimmedTitle, updated_at: new Date().toISOString() }
            : doc
        )
      )

      setRenameOpen(false)
      setRenameDocId(null)
      setRenameTitle("")
      toast.success("文档名称已更新")
    } catch (error) {
      toast.error(getActionErrorMessage(error, "重命名失败，请检查网络后重试"))
    } finally {
      setRenameSubmitting(false)
    }
  }, [getActionErrorMessage, renameDocId, renameTitle])

  const handleDocumentUpdate = useCallback(
    async (docId: string, updates: { content?: Json | null; content_text?: string; word_count?: number }) => {
      try {
        const result = await updateDocument(docId, updates)

        if (result.error) {
          return { error: result.error }
        }

        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, ...updates, updated_at: new Date().toISOString() } : d))
        )

        return { success: true }
      } catch (error) {
        return { error: getActionErrorMessage(error, "保存文档失败，请检查网络后重试") }
      }
    },
    [getActionErrorMessage]
  )

  const handleInsertText = useCallback(
    (text: string) => {
      setEditorContent(text)
    },
    []
  )

  const [replaceContent, setReplaceContent] = useState("")

  const handleReplaceSelection = useCallback(
    (text: string) => {
      // Append timestamp to ensure uniqueness even for identical content
      setReplaceContent(text + "\0" + Date.now())
    },
    []
  )

  const toggleRightPanel = useCallback((panel: RightPanelType) => {
    setRightPanel((current) => current === panel ? "none" : panel)
  }, [])

  const toggleFocusMode = useCallback(() => {
    setFocusMode((current) => !current)
  }, [])

  const totalWordCount = documents.reduce((sum, d) => sum + (d.word_count || 0), 0)

  const handleRetryAutosave = useCallback(() => {
    setAutosaveRetryRequestId((current) => current + 1)
  }, [])

  const renderEditorArea = () => (
    <div className="flex h-full flex-col">
      {hasCanvasEntry && (
        <div className="border-b bg-blue-50/80 px-3 py-2 text-xs text-blue-900">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              来自画布节点：
              <strong className="px-1">{entryContext.nodeLabel || "未命名节点"}</strong>
              （{entryContext.nodeType || "beat"}）
            </span>
            {entryContext.nodeSummary && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEditorContent(entryContext.nodeSummary)}
              >
                插入节点摘要
              </Button>
            )}
            <Link href={canvasBackHref}>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                返回画布
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowEntryHint(false)}
            >
              隐藏提示
            </Button>
          </div>
        </div>
      )}
      {activeDocument && (
        <>
          <SaveStatusBanner
            status={autosaveStatus}
            onRetry={autosaveStatus === "error" ? handleRetryAutosave : undefined}
          />
          <AIToolbar
            selectedText={selectedText}
            documentContent={activeDocument.content_text || ""}
            projectId={project.id}
            documentId={activeDocument.id}
            onInsertText={handleInsertText}
            onReplaceSelection={handleReplaceSelection}
            plugins={plugins}
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
            replaceContent={replaceContent}
            saliencyData={saliencyMap}
            onAutosaveStatusChange={setAutosaveStatus}
            retryRequestId={autosaveRetryRequestId}
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
            documentId={activeDocument?.id || null}
            documentContent={activeDocument?.content_text || ""}
            onInsertToEditor={(text) => handleInsertText(text)}
            hasStyleSample={Boolean(initialStoryBible?.style_sample)}
            characters={initialCharacters}
          />
        )
      case "muse":
        return (
          <MusePanel
            projectId={project.id}
            documentId={activeDocument?.id || null}
            documentContent={activeDocument?.content_text || ""}
            onUseAsDirection={(text) => handleInsertText(text)}
            hasStyleSample={Boolean(initialStoryBible?.style_sample)}
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

  const bibleNeedsAttention = useMemo(() => {
    if (!initialStoryBible) return true
    const keyFields = [
      initialStoryBible.genre,
      initialStoryBible.synopsis,
      initialStoryBible.setting,
    ]
    const filled = keyFields.filter((f) => f && f.trim().length > 0).length
    return filled < 2
  }, [initialStoryBible])

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
          {/* AI Config Quick Access */}
          <Popover open={aiConfigOpen} onOpenChange={handleSwitcherOpen}>
            <PopoverTrigger asChild>
              {aiConfigured && aiConfig ? (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs font-normal">
                    {aiConfig.modelName || aiConfig.modelId}
                  </Badge>
                  <ChevronsUpDown className="h-3 w-3 opacity-50" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                  <Settings className="h-3.5 w-3.5" />
                  配置 AI
                </Button>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto p-0" align="end">
              {aiConfigured && aiConfig ? (
                <Command>
                  <CommandInput
                    placeholder="搜索模型..."
                    value={switcherSearch}
                    onValueChange={setSwitcherSearch}
                  />
                  <CommandList>
                    {switcherLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>
                          {switcherSearch.trim() ? (
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
                              onClick={() => handleModelSwitch(switcherSearch.trim(), switcherSearch.trim())}
                            >
                              使用 &quot;{switcherSearch.trim()}&quot;
                            </button>
                          ) : (
                            <p className="py-2 text-sm text-muted-foreground">无可用模型</p>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {switcherModels.map((model) => (
                            <CommandItem
                              key={model.id}
                              value={model.id}
                              onSelect={() => handleModelSwitch(model.id, model.name)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  aiConfig.modelId === model.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="text-sm">{model.name || model.id}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                  <div className="border-t px-2 py-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs text-muted-foreground"
                      onClick={() => {
                        setAiConfigOpen(false)
                        window.location.href = "/settings"
                      }}
                    >
                      <Settings className="mr-1.5 h-3 w-3" />
                      AI 设置
                    </Button>
                  </div>
                </Command>
              ) : (
                <div className="p-3">
                  <AIProviderForm variant="compact" />
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-xs text-muted-foreground">
            {totalWordCount.toLocaleString()} 字
          </span>
          <Separator orientation="vertical" className="h-6" />
          {focusEnhancementEnabled ? (
            <>
              <Button
                variant={focusMode ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={toggleFocusMode}
              >
                专注模式
              </Button>
              <span data-testid="editor-focus-mode" data-active={focusMode ? "true" : "false"} className="sr-only">
                {focusMode ? "开启" : "关闭"}
              </span>
              <Separator orientation="vertical" className="h-6" />
            </>
          ) : null}
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
                className="relative h-8 w-8"
                onClick={() => toggleRightPanel("bible")}
              >
                <BookOpen className="h-4 w-4" />
                {bibleNeedsAttention && rightPanel !== "bible" && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />
                )}
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
        {!focusMode && (
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
                    {documents.map((doc, index) => (
                      (() => {
                        const progressTag = getDocumentProgressTag(doc)
                        const progressMeta = documentProgressTagMeta[progressTag]
                        const isCurrentDocument = activeDocId === doc.id
                        const showRecentMarker = isDocumentRecentlyEdited(doc)

                        return (
                          <div
                            key={doc.id}
                            className={cn(
                              "group rounded-md px-2 py-2 text-sm transition-colors",
                              isCurrentDocument
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => setActiveDocId(doc.id)}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{doc.title}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <span>{(doc.word_count || 0).toLocaleString()} 字</span>
                                  <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px] font-normal", progressMeta.className)}>
                                    {progressMeta.label}
                                  </Badge>
                                  {isCurrentDocument ? (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                                      当前文档
                                    </Badge>
                                  ) : showRecentMarker ? (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                                      最近编辑
                                    </Badge>
                                  ) : null}
                                </div>
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openRenameDialog(doc)
                                    }}
                                    disabled={renameSubmitting || deletingDocId === doc.id || reorderingDocId === doc.id}
                                  >
                                    重命名
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleReorderDocument(doc.id, "up")
                                    }}
                                    disabled={index === 0 || deletingDocId === doc.id || reorderingDocId !== null}
                                  >
                                    <ArrowUp className="mr-2 h-4 w-4" />
                                    上移
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleReorderDocument(doc.id, "down")
                                    }}
                                    disabled={
                                      index === documents.length - 1 ||
                                      deletingDocId === doc.id ||
                                      reorderingDocId !== null
                                    }
                                  >
                                    <ArrowDown className="mr-2 h-4 w-4" />
                                    下移
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteDocument(doc.id)
                                    }}
                                    disabled={deletingDocId === doc.id || reorderingDocId === doc.id || renameSubmitting}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        )
                      })()
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
                    onClick={() => {
                      toast.message("支持 .txt/.docx，单文件最大 5MB")
                      fileInputRef.current?.click()
                    }}
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
        )}

        {/* Editor + Right Panel */}
        {!focusMode && rightPanel !== "none" ? (
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

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          if (renameSubmitting) {
            return
          }
          setRenameOpen(open)
          if (!open) {
            setRenameDocId(null)
            setRenameTitle("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名文档</DialogTitle>
            <DialogDescription>输入新的文档标题，保存后立即生效。</DialogDescription>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            maxLength={120}
            placeholder="请输入文档标题"
            disabled={renameSubmitting}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleRenameDocument()
              }
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRenameOpen(false)
                setRenameDocId(null)
                setRenameTitle("")
              }}
              disabled={renameSubmitting}
            >
              取消
            </Button>
            <Button type="button" onClick={handleRenameDocument} disabled={renameSubmitting}>
              {renameSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
