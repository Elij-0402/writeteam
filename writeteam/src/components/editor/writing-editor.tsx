"use client"

import { memo, useEffect, useRef, useState, useCallback } from "react"
import type { Json } from "@/types/database"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import CharacterCount from "@tiptap/extension-character-count"
import Highlight from "@tiptap/extension-highlight"
import Typography from "@tiptap/extension-typography"
import type { Document } from "@/types/database"
import { SelectionAIMenu } from "@/components/editor/selection-ai-menu"
import { Button } from "@/components/ui/button"
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Minus,
  Loader2,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface WritingEditorProps {
  document: Document
  projectId: string
  onUpdate: (
    docId: string,
    updates: { content?: Json | null; content_text?: string; word_count?: number }
  ) => Promise<{ success?: boolean; error?: string }>
  onSelectionChange: (text: string) => void
  insertContent?: string
}

type AutosaveState =
  | { status: "idle" }
  | { status: "saving"; docId: string }
  | { status: "saved"; docId: string; savedAt: string }
  | { status: "error"; docId: string; message: string }

function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

export const WritingEditor = memo(function WritingEditor({
  document,
  projectId,
  onUpdate,
  onSelectionChange,
  insertContent,
}: WritingEditorProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastInsertRef = useRef<string>("")
  const latestDraftRef = useRef<{ content: Json | null; content_text: string; word_count: number } | null>(null)
  const latestSaveRequestRef = useRef(0)
  const [autosaveState, setAutosaveState] = useState<AutosaveState>({ status: "idle" })

  const persistDraft = useCallback(
    async (draft: { content: Json | null; content_text: string; word_count: number }) => {
      latestDraftRef.current = draft
      const requestId = latestSaveRequestRef.current + 1
      latestSaveRequestRef.current = requestId
      setAutosaveState({ status: "saving", docId: document.id })

      let result: { success?: boolean; error?: string }
      try {
        result = await onUpdate(document.id, draft)
      } catch {
        result = { error: "保存文档失败，请检查网络后重试" }
      }

      if (latestSaveRequestRef.current !== requestId) {
        return
      }

      if (result.error) {
        setAutosaveState({ status: "error", docId: document.id, message: result.error })
        return
      }

      setAutosaveState({
        status: "saved",
        docId: document.id,
        savedAt: new Date().toLocaleTimeString("zh-CN"),
      })
    },
    [document.id, onUpdate]
  )

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    latestSaveRequestRef.current += 1
    latestDraftRef.current = null
  }, [document.id])

  const handleRetrySave = useCallback(() => {
    if (!latestDraftRef.current) {
      return
    }

    void persistDraft(latestDraftRef.current)
  }, [persistDraft])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder: "开始创作你的故事...",
        }),
        CharacterCount,
        Highlight,
        Typography,
      ],
      content: (document.content as Record<string, unknown>) || "<p></p>",
      editorProps: {
        attributes: {
          class:
            "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-12rem)] px-8 py-6 lg:px-16 lg:py-8",
        },
      },
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = setTimeout(() => {
          const json = editor.getJSON()
          const text = editor.getText()
          const wordCount = countWords(text)
          void persistDraft({
            content: json,
            content_text: text,
            word_count: wordCount,
          })
        }, 1000)
      },
      onSelectionUpdate: ({ editor }) => {
        const { from, to } = editor.state.selection
        if (from !== to) {
          const text = editor.state.doc.textBetween(from, to, " ")
          onSelectionChange(text)
        } else {
          onSelectionChange("")
        }
      },
    },
    [document.id, persistDraft]
  )

  // Handle external content insertion
  useEffect(() => {
    if (insertContent && insertContent !== lastInsertRef.current && editor) {
      lastInsertRef.current = insertContent
      editor.chain().focus().insertContent(insertContent).run()
    }
  }, [insertContent, editor])

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  if (!editor) return null

  const wordCount = countWords(editor.getText())

  const renderAutosaveStatus = () => {
    const stateMatchesCurrentDoc =
      autosaveState.status === "idle" || autosaveState.docId === document.id

    if (!stateMatchesCurrentDoc) {
      return <span className="text-xs text-muted-foreground">自动保存已启用（1 秒）</span>
    }

    if (autosaveState.status === "idle") {
      return <span className="text-xs text-muted-foreground">自动保存已启用（1 秒）</span>
    }

    if (autosaveState.status === "saving") {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="h-3 w-3 animate-spin" />
          正在自动保存...
        </span>
      )
    }

    if (autosaveState.status === "saved") {
      return (
        <span className="text-xs text-emerald-600" aria-live="polite">
          已保存 {autosaveState.savedAt}
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-2 text-xs text-destructive" aria-live="polite">
        自动保存失败，可继续编辑
        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={handleRetrySave}>
          立即重试
        </Button>
      </span>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        <ToolbarButton
          icon={<Bold className="h-4 w-4" />}
          label="加粗"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={<Italic className="h-4 w-4" />}
          label="斜体"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={<Strikethrough className="h-4 w-4" />}
          label="删除线"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ToolbarButton
          icon={<Heading1 className="h-4 w-4" />}
          label="标题 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarButton
          icon={<Heading2 className="h-4 w-4" />}
          label="标题 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          icon={<Heading3 className="h-4 w-4" />}
          label="标题 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ToolbarButton
          icon={<List className="h-4 w-4" />}
          label="无序列表"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={<ListOrdered className="h-4 w-4" />}
          label="有序列表"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={<Quote className="h-4 w-4" />}
          label="引用"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={<Minus className="h-4 w-4" />}
          label="分割线"
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ToolbarButton
          icon={<Undo className="h-4 w-4" />}
          label="撤销"
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          icon={<Redo className="h-4 w-4" />}
          label="重做"
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
        />
        <div className="ml-auto flex items-center gap-3">
          {autosaveState.status === "error" && autosaveState.docId === document.id ? (
            <span className="text-xs text-destructive" title={autosaveState.message}>
              {autosaveState.message}
            </span>
          ) : null}
          {renderAutosaveStatus()}
          <span className="text-xs text-muted-foreground">字数 {wordCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
        <SelectionAIMenu
          editor={editor}
          projectId={projectId}
          documentId={document.id}
        />
      </div>
    </div>
  )
})

function ToolbarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", active && "bg-accent")}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
