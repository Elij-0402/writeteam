"use client"

import { useEffect, useRef } from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Sparkles, Image as ImageIcon, BookOpen } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface SlashCommand {
  command: string
  label: string
  description: string
  icon: LucideIcon
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: "/muse what-if", label: "灵感 \u00b7 如果...", description: "生成 What-if 场景", icon: Sparkles },
  { command: "/muse random", label: "灵感 \u00b7 随机提示", description: "生成随机写作提示", icon: Sparkles },
  { command: "/muse suggest", label: "灵感 \u00b7 建议方向", description: "分析当前文本并建议方向", icon: Sparkles },
  { command: "/visualize", label: "可视化场景", description: "根据描述生成图片", icon: ImageIcon },
  { command: "/bible", label: "故事圣经", description: "查看或编辑故事圣经", icon: BookOpen },
]

interface ChatSlashCommandsProps {
  input: string
  onSelect: (command: string) => void
  visible: boolean
}

export function ChatSlashCommands({ input, onSelect, visible }: ChatSlashCommandsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter commands based on what user typed after "/"
  const query = input.startsWith("/") ? input.slice(1).toLowerCase() : ""
  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(query) ||
      cmd.label.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query)
  )

  // Close on Escape is handled by parent
  useEffect(() => {
    if (visible && containerRef.current) {
      containerRef.current.focus()
    }
  }, [visible])

  if (!visible || filtered.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 z-50 mb-1"
    >
      <Command className="rounded-lg border shadow-md">
        <CommandList>
          <CommandEmpty>没有匹配的命令</CommandEmpty>
          <CommandGroup heading="斜杠命令">
            {filtered.map((cmd) => {
              const Icon = cmd.icon
              return (
                <CommandItem
                  key={cmd.command}
                  value={cmd.command}
                  onSelect={() => onSelect(cmd.command)}
                  className="cursor-pointer"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{cmd.label}</span>
                    <span className="text-xs text-muted-foreground">{cmd.description}</span>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground font-mono">
                    {cmd.command}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
