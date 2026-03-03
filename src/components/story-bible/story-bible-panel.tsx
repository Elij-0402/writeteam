"use client"

import { useState } from "react"
import type { StoryBible, Character } from "@/types/database"
import { updateStoryBible, createCharacter, updateCharacter, deleteCharacter } from "@/app/actions/story-bible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  FileText,
  Lightbulb,
  Eye,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { ConflictWorkbench } from "@/components/story-bible/conflict-workbench"
import { CharacterCard } from "./character-card"
import { CollapsibleSection } from "./collapsible-section"
import { CompletionIndicator } from "./completion-indicator"
import {
  parseWorldbuildingSections,
  serializeWorldbuildingSections,
  DEFAULT_SECTION_TITLES,
  type WorldbuildingSection,
} from "@/lib/story-bible/worldbuilding-sections"

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [hasConflict, setHasConflict] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialBible?.updated_at ?? null)
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
  const [worldSections, setWorldSections] = useState<WorldbuildingSection[]>(
    () => {
      const parsed = parseWorldbuildingSections(initialBible?.worldbuilding || "")
      if (parsed.length === 0) {
        return DEFAULT_SECTION_TITLES.map(title => ({ title, content: "" }))
      }
      return parsed
    }
  )
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

  const overviewFields = { genre, style, pov, tense, tone, synopsis, themes }
  const overviewFilled = Object.values(overviewFields).filter(v => v.trim() !== "").length
  const overviewTotal = Object.keys(overviewFields).length

  const guidanceFields = { aiRules, braindump, outlineText, notes }
  const guidanceFilled = Object.values(guidanceFields).filter(v => v.trim() !== "").length
  const guidanceTotal = Object.keys(guidanceFields).length

  function isFieldVisible(field: string): boolean {
    return visibility[field] !== false
  }

  function toggleFieldVisibility(field: string) {
    setVisibility((prev) => ({
      ...prev,
      [field]: prev[field] === false ? true : false,
    }))
    setHasUnsavedChanges(true)
  }

  function markDirty() {
    setHasUnsavedChanges(true)
  }

  function handleApplyConflict() {
    window.location.reload()
  }

  async function handleSaveBible() {
    if (saving || hasConflict) return
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
      worldbuilding: serializeWorldbuildingSections(worldSections),
      outline: parseOutlineInput(outlineText),
      notes,
      tone,
      ai_rules: aiRules,
      visibility,
    }, lastSavedAt)

    if (result.error) {
      if ("conflict" in result && result.conflict) {
        setHasConflict(true)
        toast.error("检测到并发冲突：请刷新页面后重新编辑并保存，避免误覆盖。")
      } else {
        toast.error(result.error)
      }
    } else {
      toast.success("故事圣经已保存")
      setHasUnsavedChanges(false)
      setHasConflict(false)
      setLastSavedAt(("updatedAt" in result ? result.updatedAt : null) ?? new Date().toISOString())
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
          <div>
            <h3 className="text-sm font-semibold">故事圣经</h3>
            <p className="text-[10px] text-muted-foreground">
              {saving
                ? "保存中..."
                : hasConflict
                  ? "检测到并发冲突，请刷新后再保存"
                : hasUnsavedChanges
                  ? "有未保存更改"
                  : lastSavedAt
                    ? `上次保存：${new Date(lastSavedAt).toLocaleString("zh-CN")}`
                    : "尚未保存"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasConflict && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3" />
              刷新
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleSaveBible}
            disabled={saving || hasConflict}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            保存
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex flex-1 flex-col">
        <div className="px-4 pt-3">
          <ConflictWorkbench
            conflicts={
              hasConflict
                ? [
                    {
                      id: "save-conflict",
                      title: "检测到并发冲突，当前编辑可能覆盖他人修改",
                      severity: "high",
                      evidenceSource: "保存校验",
                    },
                  ]
                : []
            }
            onApplyConflict={handleApplyConflict}
          />
        </div>
        <TabsList className="mx-4 mt-2 grid w-auto grid-cols-5">
          <TabsTrigger value="overview" className="text-xs">
            概览
          </TabsTrigger>
          <TabsTrigger value="characters" className="text-xs">
            角色
          </TabsTrigger>
          <TabsTrigger value="world" className="text-xs">
            世界观
          </TabsTrigger>
          <TabsTrigger value="guidance" className="text-xs">
            创作指导
          </TabsTrigger>
          <TabsTrigger value="visibility" className="text-xs">
            AI 可见性
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 py-3">
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0 space-y-4">
            <CompletionIndicator filled={overviewFilled} total={overviewTotal} />

            <CollapsibleSection title="核心设定" defaultOpen={true}>
              <div className="space-y-2">
                <Label className="text-xs">题材</Label>
                <Textarea
                  placeholder="你的故事属于哪个类型？如：都市悬疑、奇幻冒险、科幻末世..."
                  value={genre}
                  onChange={(e) => {
                    setGenre(e.target.value)
                    markDirty()
                  }}
                  rows={2}
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">风格</Label>
                <Textarea
                  placeholder="你期望的写作风格？如：紧凑明快、细腻文学、幽默讽刺..."
                  value={style}
                  onChange={(e) => {
                    setStyle(e.target.value)
                    markDirty()
                  }}
                  rows={2}
                  className="text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">POV</Label>
                  <Input
                    placeholder="第一人称、第三人称有限..."
                    value={pov}
                    onChange={(e) => {
                      setPov(e.target.value)
                      markDirty()
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">时态</Label>
                  <Input
                    placeholder="过去时、现在时..."
                    value={tense}
                    onChange={(e) => {
                      setTense(e.target.value)
                      markDirty()
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">语调</Label>
                <Input
                  placeholder="故事的整体情绪基调？如：压抑、温暖、紧张..."
                  value={tone}
                  onChange={(e) => {
                    setTone(e.target.value)
                    markDirty()
                  }}
                  className="h-8 text-xs"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="故事内容" defaultOpen={true}>
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> 故事梗概
                </Label>
                <Textarea
                  placeholder="用几段话描述你的故事核心情节——AI 会以此为叙事指南"
                  value={synopsis}
                  onChange={(e) => {
                    setSynopsis(e.target.value)
                    markDirty()
                  }}
                  rows={4}
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">主题</Label>
                <Textarea
                  placeholder="你想探索的核心主题？如：救赎、权力腐化、人性光辉..."
                  value={themes}
                  onChange={(e) => {
                    setThemes(e.target.value)
                    markDirty()
                  }}
                  rows={3}
                  className="text-xs"
                />
              </div>
            </CollapsibleSection>
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
                      <div className="grid gap-2">
                        <Label>角色描述</Label>
                        <Textarea name="description" placeholder="简要角色描述..." rows={2} />
                      </div>
                      <div className="grid gap-2">
                        <Label>性格</Label>
                        <Textarea name="personality" placeholder="角色特征、习惯..." rows={2} />
                      </div>
                      <div className="grid gap-2">
                        <Label>外貌</Label>
                        <Textarea name="appearance" placeholder="外形描写..." rows={2} />
                      </div>
                      <div className="grid gap-2">
                        <Label>背景经历</Label>
                        <Textarea name="backstory" placeholder="角色过往经历..." rows={2} />
                      </div>
                      <div className="grid gap-2">
                        <Label>目标</Label>
                        <Textarea name="goals" placeholder="这个角色想要什么？" rows={2} />
                      </div>
                      <div className="grid gap-2">
                        <Label>关系</Label>
                        <Textarea name="relationships" placeholder="与其他角色的关系..." rows={2} />
                      </div>
                      <div className="grid gap-2">
                        <Label>对话风格</Label>
                        <Textarea name="dialogue_style" placeholder="角色说话的特点、口头禅、语气..." rows={2} />
                      </div>
                      <div className="grid gap-2">
                        <Label>备注</Label>
                        <Textarea name="notes" placeholder="补充设定、禁忌和口头禅等..." rows={2} />
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
              <div className="space-y-2">
                {characters.map((char) => (
                  <CharacterCard
                    key={char.id}
                    character={{
                      ...char,
                      dialogue_style: (char as Record<string, unknown>).dialogue_style as string | null ?? null,
                    }}
                    onUpdate={handleUpdateCharacter}
                    onDelete={(id) => handleDeleteCharacter(id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* World Tab */}
          <TabsContent value="world" className="mt-0 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">场景设定</Label>
              <Textarea
                value={setting}
                onChange={(e) => { setSetting(e.target.value); markDirty() }}
                placeholder="故事发生的主要场景、时代和地点..."
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">世界设定</Label>
              <div className="space-y-2">
                {worldSections.map((section, index) => (
                  <CollapsibleSection
                    key={section.title}
                    title={section.title}
                    defaultOpen={section.content.trim() !== ""}
                  >
                    <Textarea
                      value={section.content}
                      onChange={(e) => {
                        const next = [...worldSections]
                        next[index] = { ...next[index], content: e.target.value }
                        setWorldSections(next)
                        markDirty()
                      }}
                      placeholder={getWorldSectionPlaceholder(section.title)}
                      rows={3}
                      className="text-sm"
                    />
                  </CollapsibleSection>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setWorldSections(prev => [...prev, { title: "自定义分区", content: "" }])
                markDirty()
              }}
            >
              + 添加自定义分区
            </Button>
          </TabsContent>

          {/* Guidance Tab */}
          <TabsContent value="guidance" className="mt-0 space-y-4">
            <CompletionIndicator filled={guidanceFilled} total={guidanceTotal} />

            <CollapsibleSection title="AI 规则" defaultOpen={true}>
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> AI 规则
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  AI 必须严格遵守的硬规则，优先级最高
                </p>
                <Textarea
                  placeholder="给 AI 的最高优先级指令——AI 会严格遵守这些规则，覆盖其他所有设定"
                  value={aiRules}
                  onChange={(e) => {
                    setAiRules(e.target.value)
                    markDirty()
                  }}
                  rows={3}
                  className="text-xs"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="写作素材" defaultOpen={false}>
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Lightbulb className="h-3 w-3" /> 灵感池
                </Label>
                <Textarea
                  placeholder="在这里自由记录你的灵感、想法、片段——AI 会作为创意参考"
                  value={braindump}
                  onChange={(e) => {
                    setBraindump(e.target.value)
                    markDirty()
                  }}
                  rows={4}
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">大纲（JSON 或逐行）</Label>
                <Textarea
                  placeholder='[{"chapter":"第1章","beats":["节拍1","节拍2"]}] 或每行一个节拍'
                  value={outlineText}
                  onChange={(e) => {
                    setOutlineText(e.target.value)
                    markDirty()
                  }}
                  rows={4}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">备注</Label>
                <Textarea
                  placeholder="任何额外的写作指导或备注"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value)
                    markDirty()
                  }}
                  rows={3}
                  className="text-xs"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="风格控制" defaultOpen={true}>
              <div className="space-y-2">
                <Label className="text-xs">文风模式</Label>
                <Select value={proseMode} onValueChange={(value) => {
                  setProseMode(value)
                  markDirty()
                }}>
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
              {proseMode === "match-style" && (
                <div className="space-y-2">
                  <Label className="text-xs">风格样本（用于匹配风格）</Label>
                  <Textarea
                    placeholder="粘贴 1-3 段目标叙事风格文本"
                    value={styleSample}
                    onChange={(e) => {
                      setStyleSample(e.target.value)
                      markDirty()
                    }}
                    rows={4}
                    className="text-xs"
                  />
                </div>
              )}
            </CollapsibleSection>
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

function getWorldSectionPlaceholder(title: string): string {
  switch (title) {
    case "地理环境": return "故事发生在什么样的地方？气候、地形、重要地标..."
    case "势力与阵营": return "故事中有哪些组织、阵营或势力？它们之间的关系..."
    case "能力体系": return "故事中有什么特殊能力/魔法/科技体系？规则和限制..."
    case "社会与文化": return "这个世界的社会结构、文化习俗、经济体系..."
    default: return "在这里描述世界设定的这个方面..."
  }
}
