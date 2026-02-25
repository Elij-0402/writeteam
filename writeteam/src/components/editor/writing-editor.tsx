"use client"

import { useEffect, useRef } from "react"
import type { Json } from "@/types/database"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import CharacterCount from "@tiptap/extension-character-count"
import Highlight from "@tiptap/extension-highlight"
import Typography from "@tiptap/extension-typography"
import type { Document } from "@/types/database"
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
  onUpdate: (
    docId: string,
    updates: { content?: Json | null; content_text?: string; word_count?: number }
  ) => void
  onSelectionChange: (text: string) => void
  insertContent?: string
}

export function WritingEditor({
  document,
  onUpdate,
  onSelectionChange,
  insertContent,
}: WritingEditorProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastInsertRef = useRef<string>("")

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder: "Start writing your story...",
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
          const wordCount = text
            .split(/\s+/)
            .filter((word) => word.length > 0).length
          onUpdate(document.id, {
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
    [document.id]
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

  const wordCount = editor.storage.characterCount.words()

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-0.5 border-b px-2 py-1">
        <ToolbarButton
          icon={<Bold className="h-4 w-4" />}
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={<Italic className="h-4 w-4" />}
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={<Strikethrough className="h-4 w-4" />}
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ToolbarButton
          icon={<Heading1 className="h-4 w-4" />}
          label="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarButton
          icon={<Heading2 className="h-4 w-4" />}
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          icon={<Heading3 className="h-4 w-4" />}
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ToolbarButton
          icon={<List className="h-4 w-4" />}
          label="Bullet List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={<ListOrdered className="h-4 w-4" />}
          label="Ordered List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={<Quote className="h-4 w-4" />}
          label="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={<Minus className="h-4 w-4" />}
          label="Horizontal Rule"
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ToolbarButton
          icon={<Undo className="h-4 w-4" />}
          label="Undo"
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          icon={<Redo className="h-4 w-4" />}
          label="Redo"
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
        />
        <div className="ml-auto text-xs text-muted-foreground">
          {wordCount.toLocaleString()} words
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}

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
