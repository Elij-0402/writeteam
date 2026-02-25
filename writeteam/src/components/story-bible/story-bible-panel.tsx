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
} from "lucide-react"
import { toast } from "sonner"

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
    })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Story Bible saved")
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
      toast.success("Character created")
    }
    setCreatingChar(false)
  }

  async function handleDeleteCharacter(charId: string) {
    const result = await deleteCharacter(charId, projectId)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCharacters((prev) => prev.filter((c) => c.id !== charId))
      toast.success("Character deleted")
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
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Story Bible</h3>
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
          Save
        </Button>
      </div>

      <Tabs defaultValue="overview" className="flex flex-1 flex-col">
        <TabsList className="mx-4 mt-2 grid w-auto grid-cols-3">
          <TabsTrigger value="overview" className="text-xs">
            Overview
          </TabsTrigger>
          <TabsTrigger value="characters" className="text-xs">
            Characters
          </TabsTrigger>
          <TabsTrigger value="world" className="text-xs">
            World
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 py-3">
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" /> Braindump
              </Label>
              <Textarea
                placeholder="Dump all your raw ideas here — the AI will reference this..."
                value={braindump}
                onChange={(e) => setBraindump(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Genre</Label>
                <Input
                  placeholder="Fantasy, Sci-Fi..."
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Style</Label>
                <Input
                  placeholder="Dark, lyrical..."
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Prose Mode</Label>
                <Select value={proseMode} onValueChange={setProseMode}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced" className="text-xs">Balanced</SelectItem>
                    <SelectItem value="cinematic" className="text-xs">Cinematic</SelectItem>
                    <SelectItem value="lyrical" className="text-xs">Lyrical</SelectItem>
                    <SelectItem value="minimal" className="text-xs">Minimal</SelectItem>
                    <SelectItem value="match-style" className="text-xs">Match Style Sample</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">POV</Label>
                <Input
                  placeholder="Third person limited"
                  value={pov}
                  onChange={(e) => setPov(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tense</Label>
                <Input
                  placeholder="Past tense"
                  value={tense}
                  onChange={(e) => setTense(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Synopsis
              </Label>
              <Textarea
                placeholder="A high-level summary of your story..."
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Outline (JSON or line list)</Label>
              <Textarea
                placeholder='[{"chapter":"Chapter 1","beats":["Beat 1","Beat 2"]}] or one line per beat'
                value={outlineText}
                onChange={(e) => setOutlineText(e.target.value)}
                rows={4}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Themes</Label>
              <Textarea
                placeholder="The major themes explored in your story..."
                value={themes}
                onChange={(e) => setThemes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Style Sample (for Match Style)</Label>
              <Textarea
                placeholder="Paste 1-3 paragraphs in your target narrative voice"
                value={styleSample}
                onChange={(e) => setStyleSample(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </TabsContent>

          {/* Characters Tab */}
          <TabsContent value="characters" className="mt-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {characters.length} character{characters.length !== 1 ? "s" : ""}
              </span>
              <Dialog open={newCharOpen} onOpenChange={setNewCharOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form action={handleCreateCharacter}>
                    <DialogHeader>
                      <DialogTitle>New Character</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input name="name" placeholder="Character name" required />
                      </div>
                      <div className="grid gap-2">
                        <Label>Role</Label>
                        <Input
                          name="role"
                          placeholder="Protagonist, Antagonist, Side character..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={creatingChar}>
                        {creatingChar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <User className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">No characters yet</p>
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
                        label="Description"
                        value={char.description || ""}
                        placeholder="Brief character description..."
                        onSave={(val) => handleUpdateCharacter(char.id, "description", val)}
                      />
                      <CharacterField
                        label="Personality"
                        value={char.personality || ""}
                        placeholder="Character traits, quirks..."
                        onSave={(val) => handleUpdateCharacter(char.id, "personality", val)}
                      />
                      <CharacterField
                        label="Appearance"
                        value={char.appearance || ""}
                        placeholder="Physical description..."
                        onSave={(val) => handleUpdateCharacter(char.id, "appearance", val)}
                      />
                      <CharacterField
                        label="Backstory"
                        value={char.backstory || ""}
                        placeholder="Character history..."
                        onSave={(val) => handleUpdateCharacter(char.id, "backstory", val)}
                      />
                      <CharacterField
                        label="Goals"
                        value={char.goals || ""}
                        placeholder="What does this character want?"
                        onSave={(val) => handleUpdateCharacter(char.id, "goals", val)}
                      />
                      <CharacterField
                        label="Relationships"
                        value={char.relationships || ""}
                        placeholder="Connections to other characters..."
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
                        Delete Character
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
                <Globe className="h-3 w-3" /> Setting
              </Label>
              <Textarea
                placeholder="Where and when does your story take place?"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Worldbuilding
              </Label>
              <Textarea
                placeholder="Rules, magic systems, technology, society, culture..."
                value={worldbuilding}
                onChange={(e) => setWorldbuilding(e.target.value)}
                rows={8}
                className="text-xs"
              />
            </div>
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
            Save
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
