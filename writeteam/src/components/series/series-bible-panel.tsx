"use client"

import { useState } from "react"
import type { SeriesBible } from "@/types/database"
import { updateSeriesBible } from "@/app/actions/series"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Library, Save, Loader2, Globe } from "lucide-react"
import { toast } from "sonner"

interface SeriesBiblePanelProps {
  seriesId: string
  seriesBible: SeriesBible | null
}

export function SeriesBiblePanel({
  seriesId,
  seriesBible,
}: SeriesBiblePanelProps) {
  const [saving, setSaving] = useState(false)

  // Local state for bible fields
  const [genre, setGenre] = useState(seriesBible?.genre || "")
  const [style, setStyle] = useState(seriesBible?.style || "")
  const [themes, setThemes] = useState(seriesBible?.themes || "")
  const [setting, setSetting] = useState(seriesBible?.setting || "")
  const [worldbuilding, setWorldbuilding] = useState(
    seriesBible?.worldbuilding || ""
  )
  const [notes, setNotes] = useState(seriesBible?.notes || "")

  async function handleSave() {
    setSaving(true)
    const result = await updateSeriesBible(seriesId, {
      genre,
      style,
      themes,
      setting,
      worldbuilding,
      notes,
    })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("系列圣经已保存")
    }
    setSaving(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Library className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">系列圣经</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          保存
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            系列圣经中的设定会被系列内所有项目的 AI 共享参考。适合记录跨书一致的世界观、风格和主题。
          </p>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">题材</Label>
              <Input
                placeholder="奇幻、科幻..."
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">风格</Label>
              <Input
                placeholder="黑暗、抒情..."
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">主题</Label>
            <Textarea
              placeholder="整个系列要探讨的核心主题..."
              value={themes}
              onChange={(e) => setThemes(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Globe className="h-3 w-3" /> 场景设定
            </Label>
            <Textarea
              placeholder="系列的整体时空背景..."
              value={setting}
              onChange={(e) => setSetting(e.target.value)}
              rows={4}
              className="text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Globe className="h-3 w-3" /> 世界构建
            </Label>
            <Textarea
              placeholder="规则、魔法系统、科技、社会、文化等跨书共享的世界观设定..."
              value={worldbuilding}
              onChange={(e) => setWorldbuilding(e.target.value)}
              rows={8}
              className="text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">备注</Label>
            <Textarea
              placeholder="其他系列级别的补充说明..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="text-xs"
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
