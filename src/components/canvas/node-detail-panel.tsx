"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Save, Trash2, Loader2, PenLine } from "lucide-react"

const NODE_TYPE_OPTIONS = [
  { value: "beat", label: "节拍" },
  { value: "scene", label: "场景" },
  { value: "character", label: "角色" },
  { value: "location", label: "地点" },
  { value: "note", label: "备注" },
]

const COLOR_OPTIONS = [
  { value: "default", label: "默认" },
  { value: "#3b82f6", label: "蓝色" },
  { value: "#22c55e", label: "绿色" },
  { value: "#a855f7", label: "紫色" },
  { value: "#f59e0b", label: "琥珀色" },
  { value: "#ef4444", label: "红色" },
  { value: "#ec4899", label: "粉色" },
  { value: "#06b6d4", label: "青色" },
]

interface NodeData {
  id: string
  label: string
  content: string | null
  nodeType: string
  color: string | null
}

interface NodeDetailPanelProps {
  node: NodeData
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
  onGoToEditor?: (node: NodeData) => void
}

export function NodeDetailPanel({ node, onUpdate, onDelete, onClose, onGoToEditor }: NodeDetailPanelProps) {
  const [label, setLabel] = useState(node.label)
  const [content, setContent] = useState(node.content || "")
  const [nodeType, setNodeType] = useState(node.nodeType)
  const [color, setColor] = useState(node.color || "default")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onUpdate(node.id, {
      label,
      content: content || null,
      node_type: nodeType,
      color: color === "default" ? null : color,
    })
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete(node.id)
    setDeleting(false)
  }

  return (
    <div className="absolute top-0 right-0 z-20 flex h-full w-80 flex-col border-l bg-background shadow-lg">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">编辑节点</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">标题</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="节点标题"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">内容</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="节点描述内容..."
            rows={6}
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">节点类型</Label>
          <Select value={nodeType} onValueChange={setNodeType}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NODE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">颜色</Label>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="默认" />
            </SelectTrigger>
            <SelectContent>
              {COLOR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm">
                  <div className="flex items-center gap-2">
                    {opt.value ? (
                      <div
                        className="h-3 w-3 rounded-full border"
                        style={{ backgroundColor: opt.value }}
                      />
                    ) : (
                      <div className="h-3 w-3 rounded-full border bg-muted" />
                    )}
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t px-4 py-3 space-y-2">
        {onGoToEditor && (
          <Button
            variant="outline"
            className="w-full gap-1.5"
            size="sm"
            onClick={() => onGoToEditor(node)}
          >
            <PenLine className="h-3.5 w-3.5" />
            去写作
          </Button>
        )}
        <Button
          className="w-full gap-1.5"
          size="sm"
          onClick={handleSave}
          disabled={saving || !label.trim()}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          保存修改
        </Button>
        <Button
          variant="outline"
          className="w-full gap-1.5 text-destructive hover:text-destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          删除节点
        </Button>
      </div>
    </div>
  )
}
