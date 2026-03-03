import type { AutosaveStatus } from "./autosave-status"
import { cn } from "@/lib/utils"

interface SaveStatusBannerProps {
  status: AutosaveStatus
  onRetry?: () => void
}

type BannerConfig = {
  text: string
  className: string
}

const STATUS_CONFIG: Record<AutosaveStatus, BannerConfig> = {
  idle: {
    text: "自动保存已开启（1 秒）",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  saving: {
    text: "正在自动保存...",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  retrying: {
    text: "正在重试保存...",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  saved: {
    text: "内容已自动保存",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  error: {
    text: "自动保存失败，可继续编辑",
    className: "border-red-200 bg-red-50 text-red-700",
  },
}

export function SaveStatusBanner({ status, onRetry }: SaveStatusBannerProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b px-3 py-2 text-xs",
        config.className
      )}
      aria-live="polite"
    >
      <span>{config.text}</span>
      {status === "error" && onRetry ? (
        <button
          type="button"
          className="rounded border border-current px-2 py-0.5 text-xs transition-opacity hover:opacity-80"
          onClick={onRetry}
        >
          立即重试
        </button>
      ) : null}
    </div>
  )
}
