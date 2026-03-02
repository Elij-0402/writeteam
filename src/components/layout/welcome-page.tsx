"use client"

import { PenLine, FileText, Sparkles, BookOpen } from "lucide-react"

const features = [
  { icon: FileText, label: "选择文档" },
  { icon: Sparkles, label: "AI 辅助" },
  { icon: BookOpen, label: "故事圣经" },
]

export function WelcomePage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <PenLine className="h-12 w-12 text-muted-foreground" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">开始创作</h2>
          <p className="text-sm text-muted-foreground">
            从左侧选择一个项目和文档开始写作，或创建新项目
          </p>
        </div>
        <div className="flex gap-8 pt-4">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 text-muted-foreground"
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
