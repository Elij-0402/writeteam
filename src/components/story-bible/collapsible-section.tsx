"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  completionText?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  completionText,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
        <span>{title}</span>
        {completionText && (
          <Badge variant="secondary" className="ml-auto text-xs font-normal">
            {completionText}
          </Badge>
        )}
      </button>
      <div
        className={cn("space-y-3 pl-6", !open && "hidden")}
        role="region"
        aria-label={title}
      >
        {children}
      </div>
    </div>
  )
}
