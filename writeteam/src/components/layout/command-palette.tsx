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
} from "lucide-react"
import { useTheme } from "next-themes"
import { signOut } from "@/app/actions/auth"

interface CommandPaletteProps {
  onNewProject?: () => void
  onToggleStoryBible?: () => void
  onToggleChat?: () => void
}

export function CommandPalette({
  onNewProject,
  onToggleStoryBible,
  onToggleChat,
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
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard"))}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Go to Dashboard
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {onNewProject && (
            <CommandItem onSelect={() => runCommand(onNewProject)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </CommandItem>
          )}
          {onToggleStoryBible && (
            <CommandItem onSelect={() => runCommand(onToggleStoryBible)}>
              <BookOpen className="mr-2 h-4 w-4" />
              Toggle Story Bible
            </CommandItem>
          )}
          {onToggleChat && (
            <CommandItem onSelect={() => runCommand(onToggleChat)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Toggle AI Chat
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
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
            Toggle Theme
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => signOut())}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
