"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  X,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import { getImages, deleteImage } from "@/app/actions/images"
import type { Image as ImageType } from "@/types/database"

const STYLE_OPTIONS = [
  { value: "realistic", label: "写实" },
  { value: "watercolor", label: "水彩" },
  { value: "anime", label: "动漫" },
  { value: "oil-painting", label: "油画" },
  { value: "sketch", label: "素描" },
]

interface VisualizePanelProps {
  projectId: string
  selectedText?: string
  onClose?: () => void
}

export function VisualizePanel({ projectId, selectedText, onClose }: VisualizePanelProps) {
  const [text, setText] = useState(selectedText || "")
  const [style, setStyle] = useState("realistic")
  const [generating, setGenerating] = useState(false)
  const [currentImage, setCurrentImage] = useState<{ url: string; prompt: string } | null>(null)
  const [images, setImages] = useState<ImageType[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Update text when selectedText prop changes
  useEffect(() => {
    if (selectedText) {
      setText(selectedText)
    }
  }, [selectedText])

  // Load image history
  const loadImages = useCallback(async () => {
    setLoadingHistory(true)
    const result = await getImages(projectId)
    if (result.data) {
      setImages(result.data)
    }
    setLoadingHistory(false)
  }, [projectId])

  useEffect(() => {
    loadImages()
  }, [loadImages])

  async function handleGenerate() {
    if (!text.trim()) {
      toast.error("请输入描述文本")
      return
    }

    setGenerating(true)
    setCurrentImage(null)

    try {
      const response = await fetch("/api/ai/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, text, style }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "图片生成失败")
      }

      const { imageUrl, prompt } = await response.json()
      setCurrentImage({ url: imageUrl, prompt })

      // Refresh history
      await loadImages()
      toast.success("图片生成成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片生成失败")
    } finally {
      setGenerating(false)
    }
  }

  async function handleDeleteImage(imageId: string) {
    const result = await deleteImage(imageId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setImages((prev) => prev.filter((img) => img.id !== imageId))
    toast.success("图片已删除")
  }

  function handleDownload(url: string) {
    window.open(url, "_blank")
  }

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">场景可视化</h3>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-4">
          {/* Input Section */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">描述文本</Label>
            <Textarea
              placeholder="输入场景描述或粘贴文本段落，AI 将为你生成对应的图片..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">画风</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full gap-1.5"
            onClick={handleGenerate}
            disabled={generating || !text.trim()}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            {generating ? "生成中..." : "生成图片"}
          </Button>

          {/* Current Generated Image */}
          {currentImage && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">生成结果</Label>
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={currentImage.url}
                  alt="AI 生成的场景图片"
                  className="w-full h-auto"
                />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {currentImage.prompt}
              </p>
            </div>
          )}

          {/* History Gallery */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              历史记录 {!loadingHistory && `(${images.length})`}
            </Label>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">还没有生成过图片</p>
              </div>
            ) : (
              <div className="space-y-3">
                {images.map((img) => (
                  <div key={img.id} className="group relative">
                    <div className="overflow-hidden rounded-lg border">
                      <img
                        src={img.image_url}
                        alt={img.prompt}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                        {img.prompt}
                      </p>
                      <div className="flex gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDownload(img.image_url)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteImage(img.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {img.style && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {STYLE_OPTIONS.find((s) => s.value === img.style)?.label || img.style}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
