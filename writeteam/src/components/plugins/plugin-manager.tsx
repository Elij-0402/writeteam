"use client"

import { useState, useEffect, useCallback } from "react"
import type { Plugin } from "@/types/database"
import { getPlugins, createPlugin, updatePlugin, deletePlugin } from "@/app/actions/plugins"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Puzzle,
} from "lucide-react"
import { toast } from "sonner"

interface PluginManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  plugins: Plugin[]
  onPluginsChange: (plugins: Plugin[]) => void
}

interface PluginFormData {
  name: string
  description: string
  systemPrompt: string
  userPromptTemplate: string
  requiresSelection: boolean
  maxTokens: number
  temperature: number
  icon: string
}

const DEFAULT_FORM: PluginFormData = {
  name: "",
  description: "",
  systemPrompt: "",
  userPromptTemplate: "",
  requiresSelection: false,
  maxTokens: 1000,
  temperature: 0.7,
  icon: "",
}

export function PluginManager({ open, onOpenChange, projectId, plugins, onPluginsChange }: PluginManagerProps) {
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PluginFormData>(DEFAULT_FORM)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadPlugins = useCallback(async () => {
    setLoading(true)
    const result = await getPlugins(projectId)
    if (result.error) {
      toast.error(result.error)
    } else {
      onPluginsChange(result.data as Plugin[])
    }
    setLoading(false)
  }, [projectId, onPluginsChange])

  useEffect(() => {
    loadPlugins()
  }, [loadPlugins])

  function openCreateDialog() {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setDialogOpen(true)
  }

  function openEditDialog(plugin: Plugin) {
    setEditingId(plugin.id)
    setForm({
      name: plugin.name,
      description: plugin.description || "",
      systemPrompt: plugin.system_prompt,
      userPromptTemplate: plugin.user_prompt_template,
      requiresSelection: plugin.requires_selection,
      maxTokens: plugin.max_tokens,
      temperature: plugin.temperature,
      icon: plugin.icon || "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("请输入插件名称")
      return
    }
    if (!form.systemPrompt.trim()) {
      toast.error("请输入系统提示词")
      return
    }
    if (!form.userPromptTemplate.trim()) {
      toast.error("请输入用户提示词模板")
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const result = await updatePlugin(editingId, {
          name: form.name,
          description: form.description,
          systemPrompt: form.systemPrompt,
          userPromptTemplate: form.userPromptTemplate,
          requiresSelection: form.requiresSelection,
          maxTokens: form.maxTokens,
          temperature: form.temperature,
          icon: form.icon,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("插件已更新")
          setDialogOpen(false)
          await loadPlugins()
        }
      } else {
        const result = await createPlugin({
          projectId,
          name: form.name,
          description: form.description,
          systemPrompt: form.systemPrompt,
          userPromptTemplate: form.userPromptTemplate,
          requiresSelection: form.requiresSelection,
          maxTokens: form.maxTokens,
          temperature: form.temperature,
          icon: form.icon,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("插件已创建")
          setDialogOpen(false)
          await loadPlugins()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(pluginId: string) {
    setDeletingId(pluginId)
    const result = await deletePlugin(pluginId, projectId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("插件已删除")
      onPluginsChange(plugins.filter((p) => p.id !== pluginId))
    }
    setDeletingId(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-primary" />
              自定义插件
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : plugins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Puzzle className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">还没有自定义插件</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  创建插件来扩展 AI 功能
                </p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {plugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="flex items-start justify-between rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {plugin.icon && (
                          <span className="text-sm">{plugin.icon}</span>
                        )}
                        <span className="text-sm font-medium">{plugin.name}</span>
                        {plugin.requires_selection && (
                          <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                            需选中
                          </span>
                        )}
                        {!plugin.project_id && (
                          <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary">
                            全局
                          </span>
                        )}
                      </div>
                      {plugin.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {plugin.description}
                        </p>
                      )}
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEditDialog(plugin)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(plugin.id)}
                        disabled={deletingId === plugin.id}
                      >
                        {deletingId === plugin.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={openCreateDialog}
            >
              <Plus className="h-3 w-3" />
              新建插件
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "编辑插件" : "新建插件"}
            </DialogTitle>
          </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-4 py-4 pr-4">
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">插件名称</Label>
                <Input
                  placeholder="例：角色对话生成器"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">图标</Label>
                <Input
                  placeholder="emoji"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  className="h-8 text-center text-xs"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs">描述</Label>
              <Input
                placeholder="简要说明此插件用途"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label className="text-xs">系统提示词</Label>
              <p className="text-[10px] text-muted-foreground">
                定义 AI 角色与任务，AI 会以此作为行为准则
              </p>
              <Textarea
                placeholder="你是一个专业的角色对话生成器，根据角色设定生成符合其性格的对话..."
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                rows={4}
                className="text-xs"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs">用户提示词模板</Label>
              <p className="text-[10px] text-muted-foreground">
                可用变量：{"{{selection}}"} 选中文本、{"{{context}}"} 上下文、{"{{input}}"} 用户输入
              </p>
              <Textarea
                placeholder={"根据以下文本为角色生成对话：\n\n{{selection}}\n\n用户要求：{{input}}"}
                value={form.userPromptTemplate}
                onChange={(e) => setForm((f) => ({ ...f, userPromptTemplate: e.target.value }))}
                rows={5}
                className="text-xs font-mono"
              />
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <Checkbox
                id="requires-selection"
                checked={form.requiresSelection}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, requiresSelection: checked === true }))
                }
              />
              <Label htmlFor="requires-selection" className="text-xs">
                需要选中文本才能使用
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">最大 Token 数</Label>
                <Input
                  type="number"
                  min={100}
                  max={4000}
                  step={100}
                  value={form.maxTokens}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxTokens: parseInt(e.target.value) || 1000 }))
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">温度 (0.0 - 1.0)</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.temperature}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      temperature: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0.7)),
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(false)}
          >
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {editingId ? "保存修改" : "创建插件"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
