"use client"

import { useState } from "react"
import type { StoryBible, Character } from "@/types/database"
import { updateStoryBible, createCharacter, updateCharacter, deleteCharacter } from "@/app/actions/story-bible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  BookOpen,
  Plus,
  Save,
  Loader2,
  User,
  Globe,
  FileText,
  Lightbulb,
  Trash2,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"

interface StoryBiblePanelProps {
  projectId: string
  storyBible: StoryBible | null
  characters: Character[]
}

export function StoryBiblePanel({
  projectId,
  storyBible: initialBible,
  characters: initialCharacters,
}: StoryBiblePanelProps) {
  const [characters, setCharacters] = useState(initialCharacters)
  const [saving, setSaving] = useState(false)
  const [newCharOpen, setNewCharOpen] = useState(false)
  const [creatingChar, setCreatingChar] = useState(false)

  // Local state for bible fields
  const [braindump, setBraindump] = useState(initialBible?.braindump || "")
  const [genre, setGenre] = useState(initialBible?.genre || "")
  const [style, setStyle] = useState(initialBible?.style || "")
  const [proseMode, setProseMode] = useState(initialBible?.prose_mode || "balanced")
  const [styleSample, setStyleSample] = useState(initialBible?.style_sample || "")
  const [synopsis, setSynopsis] = useState(initialBible?.synopsis || "")
  const [themes, setThemes] = useState(initialBible?.themes || "")
  const [setting, setSetting] = useState(initialBible?.setting || "")
  const [pov, setPov] = useState(initialBible?.pov || "")
  const [tense, setTense] = useState(initialBible?.tense || "")
  const [worldbuilding, setWorldbuilding] = useState(initialBible?.worldbuilding || "")
  const [outlineText, setOutlineText] = useState(
    initialBible?.outline ? JSON.stringify(initialBible.outline, null, 2) : ""
  )
  const [notes, setNotes] = useState(initialBible?.notes || "")
  const [tone, setTone] = useState(initialBible?.tone || "")
  const [aiRules, setAiRules] = useState(initialBible?.ai_rules || "")
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const vis = initialBible?.visibility
    if (vis && typeof vis === "object" && !Array.isArray(vis)) {
      return vis as Record<string, boolean>
    }
    return {}
  })

  function isFieldVisible(field: string): boolean {
    return visibility[field] !== false
  }

  function toggleFieldVisibility(field: string) {
    setVisibility((prev) => ({
      ...prev,
      [field]: prev[field] === false ? true : false,
    }))
  }

  async function handleSaveBible() {
    setSaving(true)
    const result = await updateStoryBible(projectId, {
      braindump,
      genre,
      style,
      prose_mode: proseMode,
      style_sample: styleSample,
      synopsis,
      themes,
      setting,
      pov,
      tense,
      worldbuilding,
      outline: parseOutlineInput(outlineText),
      notes,
      tone,
      ai_rules: aiRules,
      visibility,
    })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("故事圣经已保存")
    }
    setSaving(false)
  }

  async function handleCreateCharacter(formData: FormData) {
    setCreatingChar(true)
    const result = await createCharacter(projectId, formData)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setCharacters((prev) => [...prev, result.data!])
      setNewCharOpen(false)
      toast.success("角色已创建")
    }
    setCreatingChar(false)
  }

  async function handleDeleteCharacter(charId: string) {
    const result = await deleteCharacter(charId, projectId)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCharacters((prev) => prev.filter((c) => c.id !== charId))
      toast.success("角色已删除")
    }
  }

  async function handleUpdateCharacter(charId: string, field: string, value: string) {
    const result = await updateCharacter(charId, { [field]: value })
    if (result.error) {
      toast.error(result.error)
    } else {
      setCharacters((prev) =>
        prev.map((c) => (c.id === charId ? { ...c, [field]: value } : c))
      )
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">故事圣经</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleSaveBible}
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

      <Tabs defaultValue="overview" className="flex flex-1 flex-col">
        <TabsList className="mx-4 mt-2 grid w-auto grid-cols-4">
          <TabsTrigger value="overview" className="text-xs">
            概览
          </TabsTrigger>
          <TabsTrigger value="characters" className="text-xs">
            角色
          </TabsTrigger>
          <TabsTrigger value="world" className="text-xs">
            世界观
          </TabsTrigger>
          <TabsTrigger value="visibility" className="text-xs">
            AI 可见性
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 py-3">
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" /> 灵感池
              </Label>
              <Textarea
                placeholder="把你的原始灵感都记录在这里，AI 会参考这些内容..."
                value={braindump}
                onChange={(e) => setBraindump(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label className="text-xs">文风模式</Label>
                <Select value={proseMode} onValueChange={setProseMode}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced" className="text-xs">均衡</SelectItem>
                    <SelectItem value="cinematic" className="text-xs">电影感</SelectItem>
                    <SelectItem value="lyrical" className="text-xs">抒情</SelectItem>
                    <SelectItem value="minimal" className="text-xs">简洁</SelectItem>
                    <SelectItem value="match-style" className="text-xs">匹配风格样本</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">语调</Label>
                <Input
                  placeholder="温暖、紧张、忧郁..."
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">POV</Label>
                <Input
                  placeholder="第三人称限知"
                  value={pov}
                  onChange={(e) => setPov(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">时态</Label>
                <Input
                  placeholder="过去时"
                  value={tense}
                  onChange={(e) => setTense(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> 故事梗概
              </Label>
              <Textarea
                placeholder="故事的高层概要..."
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">大纲（JSON 或逐行）</Label>
              <Textarea
                placeholder='[{"chapter":"第1章","beats":["节拍1","节拍2"]}] 或每行一个节拍'
                value={outlineText}
                onChange={(e) => setOutlineText(e.target.value)}
                rows={4}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">主题</Label>
              <Textarea
                placeholder="故事要探讨的核心主题..."
                value={themes}
                onChange={(e) => setThemes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">风格样本（用于匹配风格）</Label>
              <Textarea
                placeholder="粘贴 1-3 段目标叙事风格文本"
                value={styleSample}
                onChange={(e) => setStyleSample(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">备注</Label>
              <Textarea
                placeholder="其他补充说明..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> AI 规则
              </Label>
              <p className="text-[10px] text-muted-foreground">
                AI 必须严格遵守的硬规则，优先级最高
              </p>
              <Textarea
                placeholder="例：绝对不要写性描写；角色「小明」永远说方言；战斗场景不超过500字..."
                value={aiRules}
                onChange={(e) => setAiRules(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
          </TabsContent>

          {/* Characters Tab */}
          <TabsContent value="characters" className="mt-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {characters.length} 个角色
              </span>
              <Dialog open={newCharOpen} onOpenChange={setNewCharOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Plus className="h-3 w-3" />
                    添加
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form action={handleCreateCharacter}>
                    <DialogHeader>
                      <DialogTitle>新建角色</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>姓名</Label>
                        <Input name="name" placeholder="角色姓名" required />
                      </div>
                      <div className="grid gap-2">
                        <Label>定位</Label>
                        <Input
                          name="role"
                          placeholder="主角、反派、配角..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={creatingChar}>
                        {creatingChar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        创建
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <User className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">还没有角色</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-1">
                {characters.map((char) => (
                  <AccordionItem key={char.id} value={char.id} className="border rounded-md px-3">
                    <AccordionTrigger className="py-2 text-sm hover:no-underline">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{char.name}</span>
                        {char.role && (
                          <span className="text-xs text-muted-foreground">
                            ({char.role})
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-3">
                      <CharacterField
                        label="角色描述"
                        value={char.description || ""}
                        placeholder="简要角色描述..."
                        onSave={(val) => handleUpdateCharacter(char.id, "description", val)}
                      />
                      <CharacterField
                        label="性格"
                        value={char.personality || ""}
                        placeholder="角色特征、习惯..."
                        onSave={(val) => handleUpdateCharacter(char.id, "personality", val)}
                      />
                      <CharacterField
                        label="外貌"
                        value={char.appearance || ""}
                        placeholder="外形描写..."
                        onSave={(val) => handleUpdateCharacter(char.id, "appearance", val)}
                      />
                      <CharacterField
                        label="背景经历"
                        value={char.backstory || ""}
                        placeholder="角色过往经历..."
                        onSave={(val) => handleUpdateCharacter(char.id, "backstory", val)}
                      />
                      <CharacterField
                        label="目标"
                        value={char.goals || ""}
                        placeholder="这个角色想要什么？"
                        onSave={(val) => handleUpdateCharacter(char.id, "goals", val)}
                      />
                      <CharacterField
                        label="关系"
                        value={char.relationships || ""}
                        placeholder="与其他角色的关系..."
                        onSave={(val) => handleUpdateCharacter(char.id, "relationships", val)}
                      />
                      <Separator />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCharacter(char.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        删除角色
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          {/* World Tab */}
          <TabsContent value="world" className="mt-0 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> 场景设定
              </Label>
              <Textarea
                placeholder="故事发生在何时何地？"
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
                placeholder="规则、魔法系统、科技、社会、文化..."
                value={worldbuilding}
                onChange={(e) => setWorldbuilding(e.target.value)}
                rows={8}
                className="text-xs"
              />
            </div>
          </TabsContent>

          {/* Visibility Tab */}
          <TabsContent value="visibility" className="mt-0 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Eye className="h-3 w-3" /> AI 可见性控制
              </Label>
              <p className="text-[10px] text-muted-foreground">
                控制 AI 在生成内容时能看到哪些 Story Bible 字段。关闭的字段不会注入 AI 提示词。
              </p>
            </div>
            <div className="space-y-3">
              <VisibilityToggle
                label="题材和风格"
                field="genre"
                checked={isFieldVisible("genre")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="POV 与时态"
                field="pov"
                checked={isFieldVisible("pov")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="语调"
                field="tone"
                checked={isFieldVisible("tone")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="故事梗概"
                field="synopsis"
                checked={isFieldVisible("synopsis")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="主题"
                field="themes"
                checked={isFieldVisible("themes")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="场景设定"
                field="setting"
                checked={isFieldVisible("setting")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="世界构建"
                field="worldbuilding"
                checked={isFieldVisible("worldbuilding")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="大纲"
                field="outline"
                checked={isFieldVisible("outline")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="灵感池"
                field="braindump"
                checked={isFieldVisible("braindump")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="备注"
                field="notes"
                checked={isFieldVisible("notes")}
                onToggle={toggleFieldVisibility}
              />
              <VisibilityToggle
                label="角色信息"
                field="characters"
                checked={isFieldVisible("characters")}
                onToggle={toggleFieldVisibility}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              注意：AI 规则（最高优先级）和文风模式始终可见，无法关闭。
            </p>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}

function parseOutlineInput(input: string): unknown {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    const lines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    return lines.length > 0 ? lines : null
  }
}

function CharacterField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string
  value: string
  placeholder: string
  onSave: (value: string) => void
}) {
  const [localValue, setLocalValue] = useState(value)
  const [dirty, setDirty] = useState(false)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px]"
            onClick={() => {
              onSave(localValue)
              setDirty(false)
            }}
          >
            保存
          </Button>
        )}
      </div>
      <Textarea
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value)
          setDirty(true)
        }}
        onBlur={() => {
          if (dirty) {
            onSave(localValue)
            setDirty(false)
          }
        }}
        rows={2}
        className="text-xs"
      />
    </div>
  )
}

function VisibilityToggle({
  label,
  field,
  checked,
  onToggle,
}: {
  label: string
  field: string
  checked: boolean
  onToggle: (field: string) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <Switch
        checked={checked}
        onCheckedChange={() => onToggle(field)}
      />
    </div>
  )
}
