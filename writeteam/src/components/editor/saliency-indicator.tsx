"use client"

import { Users, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { SaliencyMap } from "@/lib/ai/saliency"

interface SaliencyIndicatorProps {
  saliencyMap: SaliencyMap | null
  loading?: boolean
}

export function SaliencyIndicator({
  saliencyMap,
  loading = false,
}: SaliencyIndicatorProps) {
  if (loading) {
    return (
      <div className="flex h-8 items-center gap-2 border-t bg-muted/30 px-3">
        <span className="text-xs text-muted-foreground animate-pulse">
          正在分析场景...
        </span>
      </div>
    )
  }

  if (!saliencyMap) return null

  const hasCharacters = saliencyMap.activeCharacters.length > 0
  const hasLocations = saliencyMap.activeLocations.length > 0

  if (!hasCharacters && !hasLocations) return null

  return (
    <div className="flex h-8 items-center gap-3 border-t bg-muted/30 px-3 overflow-hidden">
      {hasCharacters && (
        <div className="flex items-center gap-1.5 min-w-0">
          <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground shrink-0">
            当前角色
          </span>
          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
            {saliencyMap.activeCharacters.map((name) => (
              <Badge
                key={name}
                variant="secondary"
                className="h-5 text-[10px] px-1.5 shrink-0"
              >
                {name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {hasCharacters && hasLocations && (
        <div className="h-3 w-px bg-border shrink-0" />
      )}

      {hasLocations && (
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground shrink-0">
            当前场景
          </span>
          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
            {saliencyMap.activeLocations.map((loc) => (
              <Badge
                key={loc}
                variant="outline"
                className="h-5 text-[10px] px-1.5 shrink-0"
              >
                {loc}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
