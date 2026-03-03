"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ConflictSeverity = "high" | "medium" | "low"

interface ConflictWorkbenchItem {
  id: string
  title: string
  severity: ConflictSeverity
  evidenceSource: string
}

interface ConflictWorkbenchProps {
  conflicts: ConflictWorkbenchItem[]
  onApplyConflict: (conflictId: string) => void
}

const SEVERITY_TEXT: Record<ConflictSeverity, string> = {
  high: "高",
  medium: "中",
  low: "低",
}

const SEVERITY_CLASS: Record<ConflictSeverity, string> = {
  high: "text-destructive",
  medium: "text-amber-600",
  low: "text-muted-foreground",
}

export function ConflictWorkbench({ conflicts, onApplyConflict }: ConflictWorkbenchProps) {
  if (conflicts.length === 0) {
    return null
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs">冲突工作台</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className="flex items-start justify-between gap-3 rounded-md border bg-background p-2"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium">{conflict.title}</p>
              <p className={`text-[11px] ${SEVERITY_CLASS[conflict.severity]}`}>
                严重程度：{SEVERITY_TEXT[conflict.severity]}
              </p>
              <p className="text-[11px] text-muted-foreground">证据来源：{conflict.evidenceSource}</p>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs shrink-0"
              aria-label={`一键应用：${conflict.title}`}
              onClick={() => onApplyConflict(conflict.id)}
            >
              一键应用
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
