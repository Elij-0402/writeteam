"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Music,
  Film,
  User,
  MapPin,
  StickyNote,
  Sparkles,
  Loader2,
} from "lucide-react"

interface CanvasToolbarProps {
  onAddNode: (type: string) => void
  onAIGenerate: (outline: string) => Promise<void>
  onApplyPreview: () => Promise<void>
  onDiscardPreview: () => void
  generating: boolean
  hasPreview: boolean
  previewCount: number
}

const NODE_TYPE_BUTTONS = [
  { type: "beat", label: "节拍", icon: Music },
  { type: "scene", label: "场景", icon: Film },
  { type: "character", label: "角色", icon: User },
  { type: "location", label: "地点", icon: MapPin },
  { type: "note", label: "备注", icon: StickyNote },
]

export function CanvasToolbar({
  onAddNode,
  onAIGenerate,
  onApplyPreview,
  onDiscardPreview,
  generating,
  hasPreview,
  previewCount,
}: CanvasToolbarProps) {
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [outline, setOutline] = useState("")

  async function handleGenerate() {
    if (!outline.trim()) return
    await onAIGenerate(outline)
    setOutline("")
    setAiDialogOpen(false)
  }

  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border bg-background/95 backdrop-blur-sm px-2 py-1.5 shadow-sm">
      {NODE_TYPE_BUTTONS.map(({ type, label, icon: Icon }) => (
        <Tooltip key={type}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => onAddNode(type)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          </TooltipTrigger>
          <TooltipContent>添加{label}节点</TooltipContent>
        </Tooltip>
      ))}

      <div className="mx-1 h-5 w-px bg-border" />

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                AI 生成节拍
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>根据大纲自动生成故事节拍</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>AI 生成节拍</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              输入你的故事大纲或梗概，AI 将自动拆解为故事节拍节点。
            </p>
            <Textarea
              placeholder={"例如：\n一个年轻女孩在古老图书馆中发现了一本能预知未来的日记。\n她试图改变日记中的预言，却发现每次干预都会引发更严重的后果。\n最终她必须决定是否销毁这本日记..."}
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              rows={8}
              className="text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAiDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !outline.trim()}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              生成节拍
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasPreview && (
        <>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={generating}
            onClick={() => {
              void onApplyPreview()
            }}
          >
            采纳预览（{previewCount}）
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onDiscardPreview}
          >
            丢弃
          </Button>
        </>
      )}
    </div>
  )
}
