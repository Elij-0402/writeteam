"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import type { Character } from "@/types/database"
import { User } from "lucide-react"

function truncate(text: string | null, maxLen: number): string | null {
  if (!text) return null
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text
}

interface CharacterHoverCardProps {
  editorElement: HTMLElement | null
  characters: Character[]
  onViewCharacter?: () => void
}

export function CharacterHoverCard({
  editorElement,
  characters,
  onViewCharacter,
}: CharacterHoverCardProps) {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cardRef = useRef<HTMLDivElement>(null)

  const clearTimers = useCallback(() => {
    clearTimeout(showTimerRef.current)
    clearTimeout(hideTimerRef.current)
  }, [])

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setActiveCharacter(null)
      setPosition(null)
    }, 150)
  }, [])

  useEffect(() => {
    if (!editorElement) return

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(".character-mention") as HTMLElement | null
      if (!target) return

      const name = target.getAttribute("data-character-name")
      if (!name) return

      clearTimers()
      showTimerRef.current = setTimeout(() => {
        const char = characters.find((c) => c.name === name)
        if (!char) return

        const rect = target.getBoundingClientRect()
        setActiveCharacter(char)
        const x = Math.min(rect.left, window.innerWidth - 296)
        const y = rect.bottom + 6 + 280 > window.innerHeight
          ? rect.top - 286
          : rect.bottom + 6
        setPosition({ x, y })
      }, 300)
    }

    const handleMouseOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(".character-mention")
      if (!target) return
      clearTimeout(showTimerRef.current)
      scheduleHide()
    }

    editorElement.addEventListener("mouseover", handleMouseOver)
    editorElement.addEventListener("mouseout", handleMouseOut)

    return () => {
      editorElement.removeEventListener("mouseover", handleMouseOver)
      editorElement.removeEventListener("mouseout", handleMouseOut)
      clearTimers()
    }
  }, [editorElement, characters, clearTimers, scheduleHide])

  if (!activeCharacter || !position) return null

  const personality = truncate(activeCharacter.personality, 80)
  const appearance = truncate(activeCharacter.appearance, 60)

  return createPortal(
    <div
      ref={cardRef}
      className="fixed z-50 w-[280px] rounded-lg border bg-popover p-3 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ left: position.x, top: position.y }}
      onMouseEnter={() => clearTimeout(hideTimerRef.current)}
      onMouseLeave={scheduleHide}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">{activeCharacter.name}</p>
          {activeCharacter.role && (
            <p className="mt-0.5 text-xs text-muted-foreground">{activeCharacter.role}</p>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {personality && (
          <div>
            <span className="font-medium text-foreground">性格：</span>
            {personality}
          </div>
        )}
        {appearance && (
          <div>
            <span className="font-medium text-foreground">外貌：</span>
            {appearance}
          </div>
        )}
      </div>

      {/* Footer link */}
      {onViewCharacter && (
        <button
          type="button"
          className="mt-2 text-xs text-primary hover:underline"
          onClick={onViewCharacter}
        >
          → 查看完整资料
        </button>
      )}
    </div>,
    document.body
  )
}
