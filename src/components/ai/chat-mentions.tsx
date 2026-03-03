"use client"

import { useMemo } from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { BookOpen, User, Palette } from "lucide-react"
import type { Character } from "@/types/database"

export interface MentionItem {
  id: string
  label: string
  type: "story-bible" | "character" | "style"
}

interface ChatMentionsProps {
  input: string
  cursorPosition: number
  characters: Character[]
  onSelect: (mention: MentionItem) => void
  visible: boolean
}

const BUILT_IN_ITEMS: MentionItem[] = [
  { id: "story-bible", label: "故事圣经", type: "story-bible" },
  { id: "style", label: "风格样本", type: "style" },
]

const ICON_MAP = {
  "story-bible": BookOpen,
  character: User,
  style: Palette,
} as const

/**
 * Extract the @query text from input at the given cursor position.
 * Returns null if no active @mention query is found.
 */
export function extractMentionQuery(
  input: string,
  cursorPosition: number
): string | null {
  const textBeforeCursor = input.slice(0, cursorPosition)
  // Find the last @ that is either at the start or preceded by whitespace
  const match = textBeforeCursor.match(/(?:^|\s)@([^\s]*)$/)
  return match ? match[1] : null
}

export function ChatMentions({
  input,
  cursorPosition,
  characters,
  onSelect,
  visible,
}: ChatMentionsProps) {
  const query = extractMentionQuery(input, cursorPosition)

  const allItems = useMemo<MentionItem[]>(() => {
    const characterItems: MentionItem[] = characters.map((c) => ({
      id: `character:${c.id}`,
      label: c.name,
      type: "character" as const,
    }))
    return [...BUILT_IN_ITEMS, ...characterItems]
  }, [characters])

  const filteredItems = useMemo(() => {
    if (query === null) return allItems
    const q = query.toLowerCase()
    return allItems.filter((item) => item.label.toLowerCase().includes(q))
  }, [allItems, query])

  if (!visible || query === null) return null

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-md border bg-popover shadow-md">
      <Command>
        <CommandList>
          <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
            无匹配项
          </CommandEmpty>
          <CommandGroup heading="提及">
            {filteredItems.map((item) => {
              const Icon = ICON_MAP[item.type]
              return (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => onSelect(item)}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
