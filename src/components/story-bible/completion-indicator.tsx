"use client"

interface CompletionIndicatorProps {
  filled: number
  total: number
}

export function CompletionIndicator({ filled, total }: CompletionIndicatorProps) {
  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="relative h-5 w-5">
        <svg viewBox="0 0 36 36" className="h-5 w-5 -rotate-90">
          <circle
            cx="18" cy="18" r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-20"
          />
          <circle
            cx="18" cy="18" r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${percentage} 100`}
            strokeLinecap="round"
            className="text-primary"
          />
        </svg>
      </div>
      <span>{filled}/{total} 已填写</span>
    </div>
  )
}
