"use client"

import { useState } from "react"
import type { Series } from "@/types/database"
import { createSeries, updateSeries } from "@/app/actions/series"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface SeriesManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If provided, the dialog is in edit mode */
  series?: Series
  onCreated?: (series: Series) => void
  onUpdated?: () => void
}

export function SeriesManager({
  open,
  onOpenChange,
  series,
  onCreated,
  onUpdated,
}: SeriesManagerProps) {
  const [loading, setLoading] = useState(false)
  const isEditing = !!series

  async function handleSubmit(formData: FormData) {
    setLoading(true)

    if (isEditing) {
      const title = formData.get("title") as string
      const description = formData.get("description") as string
      const result = await updateSeries(series.id, {
        title,
        description: description || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("系列已更新")
        onUpdated?.()
        onOpenChange(false)
      }
    } else {
      const result = await createSeries(formData)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        toast.success("系列创建成功！")
        onCreated?.(result.data)
        onOpenChange(false)
      }
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "编辑系列" : "新建系列"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "修改系列的基本信息。"
                : "创建新的系列来组织多本相关的作品。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">系列名称</Label>
              <Input
                id="title"
                name="title"
                placeholder="例：星际征途三部曲"
                defaultValue={series?.title || ""}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">简介</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="简要描述这个系列..."
                defaultValue={series?.description || ""}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "保存" : "创建系列"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
