"use client"

import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from "react"
import type { Json, Plugin } from "@/types/database"
import Link from "next/link"
import type { Project, Document, StoryBible, Character } from "@/types/database"
import { createDocument, updateDocument, deleteDocument, reorderDocuments } from "@/app/actions/documents"
import { WritingEditor } from "@/components/editor/writing-editor"
import { SaveStatusBanner } from "@/components/editor/save-status-banner"
import { AIToolbar } from "@/components/ai/ai-toolbar"
import { PluginManager } from "@/components/plugins/plugin-manager"
import { SaliencyIndicator } from "@/components/editor/saliency-indicator"
import { CommandPalette } from "@/components/layout/command-palette"
import { Button } from "@/components/ui/button"
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
  FileText,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { exportAsText, exportAsDocx, exportProjectAsDocx } from "@/lib/export"
import { parseImportedFile } from "@/lib/import"
import { computeSaliency } from "@/lib/ai/saliency"
import type { SaliencyMap } from "@/lib/ai/saliency"
import { countDocumentWords } from "@/lib/text-stats"
import type { AutosaveStatus } from "@/components/editor/autosave-status"
import { useEditorContext } from "@/components/editor/editor-context"

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

/** Imperative handle exposed by EditorContent via ref. */
export interface EditorContentHandle {
  /** Switch to a specific document by ID. */
  selectDocument: (docId: string) => void
  /** Create a new document. */
  createDocument: () => Promise<void>
  /** Delete a document by ID. */
  deleteDocument: (docId: string) => Promise<void>
  /** Rename a document (opens rename dialog). */
  renameDocument: (doc: Document) => void
  /** Reorder a document up or down. */
  reorderDocument: (docId: string, direction: "up" | "down") => Promise<void>
  /** Export active document as .txt. */
  exportTxt: () => void
  /** Export active document as .docx. */
  exportDocx: () => Promise<void>
  /** Export all documents as a project .docx. */
  exportProject: () => Promise<void>
  /** Trigger the file import dialog. */
  importFile: () => void
  /** Insert text into the editor at cursor. */
  insertText: (text: string) => void
  /** Get the current documents list. */
  getDocuments: () => Document[]
  /** Get the active document ID. */
  getActiveDocId: () => string | null
}

export interface EditorContentProps {
  project: Project
  documents: Document[]
  initialDocumentId?: string
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

export const EditorContent = forwardRef<EditorContentHandle, EditorContentProps>(function EditorContent({
  project,
  documents: initialDocuments,
  initialDocumentId,
  storyBible: initialStoryBible,
  characters: initialCharacters,
  plugins: initialPlugins = [],
  entryContext = null,
}: EditorContentProps, ref) {
  const editorCtx = useEditorContext()
  const [documents, setDocuments] = useState(initialDocuments)
  const [activeDocId, setActiveDocId] = useState<string | null>(
    initialDocumentId || initialDocuments[0]?.id || null
  )
  const [, setCreatingDoc] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [editorContent, setEditorContent] = useState("")
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false)
  const [plugins, setPlugins] = useState(initialPlugins)
  const [saliencyMap, setSaliencyMap] = useState<SaliencyMap | null>(null)
  const [saliencyLoading, setSaliencyLoading] = useState(false)
  const [, setDeletingDocId] = useState<string | null>(null)
  const [reorderingDocId, setReorderingDocId] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameDocId, setRenameDocId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [renameSubmitting, setRenameSubmitting] = useState(false)
  const [showEntryHint, setShowEntryHint] = useState(true)
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle")
  const [autosaveRetryRequestId, setAutosaveRetryRequestId] = useState(0)
  const saliencyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [replaceContent, setReplaceContent] = useState("")

  const activeDocument = documents.find((d) => d.id === activeDocId) || null
  const hasCanvasEntry =
    showEntryHint &&
    entryContext?.source === "canvas" &&
    entryContext.nodeId.trim().length > 0
  const canvasBackHref = hasCanvasEntry
    ? `/canvas/${project.id}?focusNodeId=${encodeURIComponent(entryContext.nodeId)}`
    : `/canvas/${project.id}`

  const totalWordCount = documents.reduce((sum, d) => sum + (d.word_count || 0), 0)

  // Sync project info to EditorContext
  useEffect(() => {
    editorCtx?.setActiveProject(project.id, project.title)
    editorCtx?.setHasStyleSample(!!initialStoryBible?.style_sample)
  }, [project.id, project.title, initialStoryBible?.style_sample, editorCtx])

  // Sync characters to EditorContext
  useEffect(() => {
    editorCtx?.setCharacters(initialCharacters)
  }, [initialCharacters, editorCtx])

  // Sync active document info to EditorContext
  useEffect(() => {
    if (activeDocument) {
      editorCtx?.setActiveDocument(activeDocument.id, activeDocument.title)
    } else {
      editorCtx?.setActiveDocument(null, null)
    }
  }, [activeDocument, editorCtx])

  // Sync word count to EditorContext
  useEffect(() => {
    editorCtx?.setWordCount(totalWordCount)
  }, [totalWordCount, editorCtx])

  // Sync document content to EditorContext
  useEffect(() => {
    if (activeDocument?.content_text !== undefined) {
      editorCtx?.setDocumentContent(activeDocument.content_text || "")
    }
  }, [activeDocument?.content_text, editorCtx])

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

  const getActionErrorMessage = useCallback((error: unknown, fallbackMessage: string) => {
    if (typeof error === "object" && error && "message" in error) {
      const message = String((error as { message?: unknown }).message ?? "").trim()
      if (message.length > 0) {
        return message
      }
    }

    return fallbackMessage
  }, [])

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

  const handleReplaceSelection = useCallback(
    (text: string) => {
      // Append timestamp to ensure uniqueness even for identical content
      setReplaceContent(text + "\0" + Date.now())
    },
    []
  )

  const handleRetryAutosave = useCallback(() => {
    setAutosaveRetryRequestId((current) => current + 1)
  }, [])

  // Expose insertText function via EditorContext ref
  useEffect(() => {
    if (editorCtx?.insertTextRef) {
      editorCtx.insertTextRef.current = handleInsertText
    }
    return () => {
      if (editorCtx?.insertTextRef) {
        editorCtx.insertTextRef.current = null
      }
    }
  }, [editorCtx, handleInsertText])

  // Expose imperative handle for parent components (Task 9 wiring)
  useImperativeHandle(ref, () => ({
    selectDocument: (docId: string) => setActiveDocId(docId),
    createDocument: handleCreateDocument,
    deleteDocument: handleDeleteDocument,
    renameDocument: openRenameDialog,
    reorderDocument: handleReorderDocument,
    exportTxt: handleExportTxt,
    exportDocx: handleExportDocx,
    exportProject: handleExportProject,
    importFile: () => {
      toast.message("支持 .txt/.docx，单文件最大 5MB")
      fileInputRef.current?.click()
    },
    insertText: handleInsertText,
    getDocuments: () => documents,
    getActiveDocId: () => activeDocId,
  }), [
    handleCreateDocument,
    handleDeleteDocument,
    openRenameDialog,
    handleReorderDocument,
    handleExportTxt,
    handleExportDocx,
    handleExportProject,
    handleInsertText,
    documents,
    activeDocId,
  ])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CommandPalette
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

      {/* Canvas entry hint */}
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

      {/* Save status + AI Toolbar + WritingEditor + Saliency */}
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

      {/* Empty state — no active document */}
      {!activeDocument && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>请选择或创建文档后开始写作</p>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
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

      {/* Hidden file input for imports */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.docx"
        className="hidden"
        onChange={handleImportFile}
      />
    </div>
  )
})
