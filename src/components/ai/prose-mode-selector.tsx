"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PROSE_MODES = [
  { value: "default", label: "跟随故事圣经" },
  { value: "balanced", label: "均衡" },
  { value: "cinematic", label: "电影感" },
  { value: "lyrical", label: "抒情" },
  { value: "minimal", label: "简洁" },
  { value: "match-style", label: "匹配风格" },
] as const

type ProseMode = (typeof PROSE_MODES)[number]["value"]

interface ProseModeSelectProps {
  value: ProseMode
  onChange: (value: ProseMode) => void
  hasStyleSample?: boolean
  className?: string
}

export function ProseModeSelector({
  value,
  onChange,
  hasStyleSample = true,
  className,
}: ProseModeSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ProseMode)}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROSE_MODES.map((mode) => (
          <SelectItem
            key={mode.value}
            value={mode.value}
            disabled={mode.value === "match-style" && !hasStyleSample}
          >
            {mode.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
