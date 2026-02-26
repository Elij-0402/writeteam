"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { Editor } from "@tiptap/react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Pencil,
  Maximize2,
  Paintbrush,
  Minimize2,
  Palette,
  Loader2,
  Replace,
  Plus,
  Copy,
  X,
  Check,
  ChevronLeft,
  Zap,
  Image as ImageIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"

interface SelectionAIMenuProps {
  editor: Editor
  projectId: string
  documentId: string | null
  saliencyData?: { activeCharacters: string[]; activeLocations: string[]; activePlotlines: string[] } | null
  onVisualize?: (text: string) => void
}

type AIAction = "rewrite" | "expand" | "describe" | "shrink" | "tone-shift" | "quick-edit"

const TONE_OPTIONS = [
  { value: "tense", label: "紧张" },
  { value: "tender", label: "温柔" },
  { value: "humorous", label: "幽默" },
  { value: "melancholic", label: "悲伤" },
  { value: "angry", label: "愤怒" },
  { value: "mysterious", label: "神秘" },
]

export function SelectionAIMenu({
  editor,
  projectId,
  documentId,
  saliencyData,
  onVisualize,
}: SelectionAIMenuProps) {
  const { getHeaders } = useAIConfigContext()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState("")
  const [activeAction, setActiveAction] = useState<AIAction | null>(null)
  const [showToneMenu, setShowToneMenu] = useState(false)
  const [showQuickEdit, setShowQuickEdit] = useState(false)
  const [quickEditInstruction, setQuickEditInstruction] = useState("")
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const quickEditInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to

      if (hasSelection && !loading && !result) {
        const coords = editor.view.coordsAtPos(to)
        setPosition({
          top: coords.bottom + 8,
          left: Math.max(coords.left - 100, 8),
        })
        setVisible(true)
      } else if (!hasSelection && !loading && !result) {
        setVisible(false)
        setShowToneMenu(false)
        setShowQuickEdit(false)
        setQuickEditInstruction("")
      }
    }

    editor.on("selectionUpdate", handleSelectionUpdate)
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
    }
  }, [editor, loading, result])

  useEffect(() => {
    if (showQuickEdit && quickEditInputRef.current) {
      quickEditInputRef.current.focus()
    }
  }, [showQuickEdit])

  const getSelectedText = useCallback(() => {
    const { from, to } = editor.state.selection
    if (from === to) return ""
    return editor.state.doc.textBetween(from, to, " ")
  }, [editor])

  const getContext = useCallback(() => {
    return editor.getText().slice(-3000)
  }, [editor])

  async function callAI(action: AIAction, extraBody?: Record<string, string>) {
    const selectedText = getSelectedText()
    if (!selectedText) {
      toast.error("请先选中文本")
      return
    }

    setLoading(true)
    setActiveAction(action)
    setResult("")
    setCopied(false)
    setShowToneMenu(false)

    try {
      const body: Record<string, unknown> = {
        projectId,
        documentId: documentId || "",
        text: selectedText,
        context: getContext(),
        ...extraBody,
      }

      if (saliencyData) {
        body.saliency = saliencyData
      }

      let endpoint = ""
      switch (action) {
        case "rewrite":
          endpoint = "/api/ai/rewrite"
          body.mode = "rephrase"
          break
        case "expand":
          endpoint = "/api/ai/expand"
          break
        case "describe":
          endpoint = "/api/ai/describe"
          break
        case "shrink":
          endpoint = "/api/ai/shrink"
          break
        case "tone-shift":
          endpoint = "/api/ai/tone-shift"
          break
        case "quick-edit":
          endpoint = "/api/ai/quick-edit"
          body.instruction = quickEditInstruction
          break
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "AI 请求失败")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk
          setResult(fullText)
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 请求失败")
      setActiveAction(null)
    } finally {
      setLoading(false)
    }
  }

  function handleReplace() {
    if (!result) return
    const { from, to } = editor.state.selection
    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, result).run()
    resetState()
    toast.success("已替换选中文本")
  }

  function handleInsertAfter() {
    if (!result) return
    const { to } = editor.state.selection
    editor.chain().focus().insertContentAt(to, result).run()
    resetState()
    toast.success("已插入到选中文本后")
  }

  function handleCopy() {
    if (!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    toast.success("已复制到剪贴板")
    setTimeout(() => setCopied(false), 2000)
  }

  function resetState() {
    setResult("")
    setActiveAction(null)
    setShowToneMenu(false)
    setShowQuickEdit(false)
    setQuickEditInstruction("")
    setCopied(false)
    setVisible(false)
  }

  function handleToneSelect(tone: string) {
    callAI("tone-shift", { tone })
  }

  function handleQuickEditSubmit() {
    if (!quickEditInstruction.trim()) return
    callAI("quick-edit")
  }

  function handleVisualize() {
    const selectedText = getSelectedText()
    if (selectedText && onVisualize) {
      onVisualize(selectedText)
    }
  }

  if (!visible && !loading && !result) return null

  const isActive = loading || !!result

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 flex flex-col rounded-lg border bg-popover shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-0.5 p-1">
        {showToneMenu ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowToneMenu(false)}
                  disabled={loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">返回</TooltipContent>
            </Tooltip>
            {TONE_OPTIONS.map((tone) => (
              <Tooltip key={tone.value}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => handleToneSelect(tone.value)}
                    disabled={loading}
                  >
                    {tone.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  转换为{tone.label}语调
                </TooltipContent>
              </Tooltip>
            ))}
          </>
        ) : showQuickEdit ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowQuickEdit(false)}
                  disabled={loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">返回</TooltipContent>
            </Tooltip>
            <Input
              ref={quickEditInputRef}
              placeholder="输入编辑指令，如：改得更悬疑..."
              value={quickEditInstruction}
              onChange={(e) => setQuickEditInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickEditSubmit()
              }}
              className="h-8 w-56 text-xs"
              disabled={loading}
            />
            <Button
              variant="default"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={handleQuickEditSubmit}
              disabled={loading || !quickEditInstruction.trim()}
            >
              {loading && activeAction === "quick-edit" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
            </Button>
          </>
        ) : (
          <>
            <MenuButton
              icon={<Zap className="h-3.5 w-3.5" />}
              label="快编"
              tooltip="自然语言指令编辑"
              loading={loading && activeAction === "quick-edit"}
              disabled={isActive && activeAction !== "quick-edit"}
              onClick={() => setShowQuickEdit(true)}
            />
            <MenuButton
              icon={<Pencil className="h-3.5 w-3.5" />}
              label="改写"
              tooltip="改写选中文本"
              loading={loading && activeAction === "rewrite"}
              disabled={isActive && activeAction !== "rewrite"}
              onClick={() => callAI("rewrite")}
            />
            <MenuButton
              icon={<Maximize2 className="h-3.5 w-3.5" />}
              label="扩写"
              tooltip="扩写选中文本"
              loading={loading && activeAction === "expand"}
              disabled={isActive && activeAction !== "expand"}
              onClick={() => callAI("expand")}
            />
            <MenuButton
              icon={<Paintbrush className="h-3.5 w-3.5" />}
              label="描写"
              tooltip="生成感官描写"
              loading={loading && activeAction === "describe"}
              disabled={isActive && activeAction !== "describe"}
              onClick={() => callAI("describe")}
            />
            <MenuButton
              icon={<Minimize2 className="h-3.5 w-3.5" />}
              label="压缩"
              tooltip="精简压缩文本"
              loading={loading && activeAction === "shrink"}
              disabled={isActive && activeAction !== "shrink"}
              onClick={() => callAI("shrink")}
            />
            <MenuButton
              icon={<Palette className="h-3.5 w-3.5" />}
              label="语调"
              tooltip="转换语调风格"
              loading={loading && activeAction === "tone-shift"}
              disabled={isActive && activeAction !== "tone-shift"}
              onClick={() => setShowToneMenu(true)}
            />
            {onVisualize && (
              <MenuButton
                icon={<ImageIcon className="h-3.5 w-3.5" />}
                label="可视化"
                tooltip="生成场景图片"
                loading={false}
                disabled={isActive}
                onClick={handleVisualize}
              />
            )}
          </>
        )}
      </div>

      {(loading || result) && activeAction && (
        <div className="border-t">
          <ScrollArea className="max-h-[240px] p-3">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {result || (
                <span className="text-muted-foreground">正在生成...</span>
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center gap-1.5 border-t px-2 py-1.5">
            <Button
              variant="default"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleReplace}
              disabled={loading || !result}
            >
              <Replace className="h-3 w-3" />
              替换
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleInsertAfter}
              disabled={loading || !result}
            >
              <Plus className="h-3 w-3" />
              插入
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleCopy}
              disabled={loading || !result}
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              复制
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1 text-xs"
              onClick={resetState}
            >
              <X className="h-3 w-3" />
              关闭
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

function MenuButton({
  icon,
  label,
  tooltip,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  tooltip: string
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 gap-1 px-2.5 text-xs")}
          onClick={onClick}
          disabled={disabled}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
