"use client"

import { useState } from "react"
import { ChevronRight, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface CharacterCardCharacter {
  id: string
  name: string
  role: string | null
  description: string | null
  personality: string | null
  appearance: string | null
  backstory: string | null
  goals: string | null
  relationships: string | null
  notes: string | null
  dialogue_style: string | null
}

interface CharacterCardProps {
  character: CharacterCardCharacter
  onUpdate: (charId: string, field: string, value: string) => void
  onDelete: (charId: string) => void
  defaultOpen?: boolean
}

const FIELD_CONFIG = [
  { key: "role", label: "角色定位", placeholder: "主角、配角、反派...", type: "input" as const },
  { key: "description", label: "描述", placeholder: "用一两句话概括这个角色...", type: "textarea" as const },
  { key: "personality", label: "性格", placeholder: "这个角色的核心性格特征是什么？驱动他们行为的内在动力...", type: "textarea" as const },
  { key: "appearance", label: "外貌", placeholder: "这个角色的外貌特征、标志性穿着或配饰...", type: "textarea" as const },
  { key: "backstory", label: "背景", placeholder: "什么过去的经历塑造了这个角色？他们带着什么创伤或信念...", type: "textarea" as const },
  { key: "goals", label: "目标", placeholder: "这个角色在故事中想要实现什么？短期目标和终极追求...", type: "textarea" as const },
  { key: "relationships", label: "关系", placeholder: "与其他角色的关系，如：师徒 — 张三，宿敌 — 李四...", type: "textarea" as const },
  { key: "dialogue_style", label: "对话风格", placeholder: "这个角色说话有什么特点？口头禅、语气、措辞偏好...", type: "textarea" as const },
  { key: "notes", label: "备注", placeholder: "关于这个角色的其他备注...", type: "textarea" as const },
]

export function CharacterCard({ character, onUpdate, onDelete, defaultOpen = false }: CharacterCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-md border">
      {/* Collapsed header */}
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setOpen((prev) => !prev)
          }
        }}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-90"
          )}
        />
        <span className="font-semibold truncate">{character.name}</span>
        {character.role && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {character.role}
          </Badge>
        )}
        <div className="ml-auto shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            aria-label="删除角色"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(character.id)
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="space-y-3 border-t px-3 pb-3 pt-2">
          {/* Name field (always Input) */}
          <CardField
            fieldKey="name"
            label="姓名"
            placeholder="角色姓名"
            value={character.name}
            type="input"
            onSave={(value) => onUpdate(character.id, "name", value)}
          />
          {FIELD_CONFIG.map((cfg) => (
            <CardField
              key={cfg.key}
              fieldKey={cfg.key}
              label={cfg.label}
              placeholder={cfg.placeholder}
              value={(character as unknown as Record<string, unknown>)[cfg.key] as string | null}
              type={cfg.type}
              onSave={(value) => onUpdate(character.id, cfg.key, value)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CardField({
  fieldKey,
  label,
  placeholder,
  value,
  type,
  onSave,
}: {
  fieldKey: string
  label: string
  placeholder: string
  value: string | null
  type: "input" | "textarea"
  onSave: (value: string) => void
}) {
  const [localValue, setLocalValue] = useState(value || "")
  const [dirty, setDirty] = useState(false)

  const handleBlur = () => {
    if (dirty) {
      onSave(localValue)
      setDirty(false)
    }
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {type === "input" ? (
        <Input
          placeholder={placeholder}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value)
            setDirty(true)
          }}
          onBlur={handleBlur}
          className="h-8 text-xs"
          data-field={fieldKey}
        />
      ) : (
        <Textarea
          placeholder={placeholder}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value)
            setDirty(true)
          }}
          onBlur={handleBlur}
          rows={2}
          className="text-xs"
          data-field={fieldKey}
        />
      )}
    </div>
  )
}
