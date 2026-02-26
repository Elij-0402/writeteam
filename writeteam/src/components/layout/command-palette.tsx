"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Plus,
  BookOpen,
  MessageSquare,
  Moon,
  Sun,
  LogOut,
  LayoutDashboard,
  Lightbulb,
  LayoutGrid,
  Library,
} from "lucide-react"
import { useTheme } from "next-themes"
import { signOut } from "@/app/actions/auth"

interface CommandPaletteProps {
  onNewProject?: () => void
  onToggleStoryBible?: () => void
  onToggleChat?: () => void
  onToggleMuse?: () => void
  onNavigateCanvas?: () => void
}

export function CommandPalette({
  onNewProject,
  onToggleStoryBible,
  onToggleChat,
  onToggleMuse,
  onNavigateCanvas,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    []
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="输入命令或搜索..." />
      <CommandList>
        <CommandEmpty>未找到结果。</CommandEmpty>

        <CommandGroup heading="导航">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard"))}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            前往项目面板
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/series"))}
          >
            <Library className="mr-2 h-4 w-4" />
            前往系列管理
          </CommandItem>
          {onNavigateCanvas && (
            <CommandItem onSelect={() => runCommand(onNavigateCanvas)}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              打开故事画布
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="操作">
          {onNewProject && (
            <CommandItem onSelect={() => runCommand(onNewProject)}>
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </CommandItem>
          )}
          {onToggleStoryBible && (
            <CommandItem onSelect={() => runCommand(onToggleStoryBible)}>
              <BookOpen className="mr-2 h-4 w-4" />
              切换故事圣经
            </CommandItem>
          )}
          {onToggleChat && (
            <CommandItem onSelect={() => runCommand(onToggleChat)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              切换 AI 对话
            </CommandItem>
          )}
          {onToggleMuse && (
            <CommandItem onSelect={() => runCommand(onToggleMuse)}>
              <Lightbulb className="mr-2 h-4 w-4" />
              切换灵感伙伴
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="设置">
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                setTheme(theme === "dark" ? "light" : "dark")
              )
            }
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            切换主题
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => signOut())}
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
