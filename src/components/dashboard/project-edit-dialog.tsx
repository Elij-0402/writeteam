"use client"

import { useState, useEffect } from "react"
import type { Project } from "@/types/database"
import { GENRES } from "@/lib/genre-colors"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface ProjectEditDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (projectId: string, data: FormData) => Promise<void>
}

export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
  onSave,
}: ProjectEditDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [genre, setGenre] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (project && open) {
      setTitle(project.title)
      setDescription(project.description || "")
      setGenre(project.genre || "")
    }
  }, [project, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!project || !title.trim()) return
    setLoading(true)
    const resolvedGenre = genre === "none" ? "" : genre
    const formData = new FormData()
    formData.append("title", title.trim())
    formData.append("description", description)
    formData.append("genre", resolvedGenre)
    await onSave(project.id, formData)
    setLoading(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) {
          setTitle("")
          setDescription("")
          setGenre("")
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>编辑项目信息</DialogTitle>
            <DialogDescription>
              修改项目的标题、简介和题材。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">标题</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="项目标题"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">简介</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述你的项目..."
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-genre">题材</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
                  <SelectValue placeholder="选择题材" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不设置题材</SelectItem>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
