"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sparkles,
  Loader2,
  Lightbulb,
  Shuffle,
  Compass,
  ArrowRight,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"

interface MuseGeneration {
  id: string
  mode: "what-if" | "random-prompt" | "suggest"
  text: string
  timestamp: number
}

interface MusePanelProps {
  projectId: string
  documentContent: string
  onUseAsDirection: (text: string) => void
}

const MODE_CONFIG = {
  "what-if": {
    label: "假如...",
    icon: Lightbulb,
    description: "生成\"假如\"情景，探索故事新方向",
  },
  "random-prompt": {
    label: "随机灵感",
    icon: Shuffle,
    description: "生成随机写作灵感",
  },
  "suggest": {
    label: "AI 建议",
    icon: Compass,
    description: "分析当前文本并建议下一步方向",
  },
} as const

type MuseMode = keyof typeof MODE_CONFIG

export function MusePanel({
  projectId,
  documentContent,
  onUseAsDirection,
}: MusePanelProps) {
  const { getHeaders } = useAIConfigContext()
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState<MuseMode | null>(null)
  const [whatIfInput, setWhatIfInput] = useState("")
  const [generations, setGenerations] = useState<MuseGeneration[]>([])
  const [streamingText, setStreamingText] = useState("")

  const callMuse = useCallback(
    async (mode: MuseMode) => {
      setLoading(true)
      setActiveMode(mode)
      setStreamingText("")

      try {
        const body: Record<string, string> = {
          mode,
          projectId,
          context: documentContent.slice(-5000),
        }

        if (mode === "what-if" && whatIfInput.trim()) {
          body.input = whatIfInput.trim()
        }

        const response = await fetch("/api/ai/muse", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getHeaders() },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "灵感生成失败")
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullText = ""

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            fullText += chunk
            setStreamingText(fullText)
          }
        }

        if (fullText) {
          const newGeneration: MuseGeneration = {
            id: crypto.randomUUID(),
            mode,
            text: fullText,
            timestamp: Date.now(),
          }
          setGenerations((prev) => [newGeneration, ...prev])
          setStreamingText("")
          if (mode === "what-if") {
            setWhatIfInput("")
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "灵感生成失败")
      } finally {
        setLoading(false)
        setActiveMode(null)
      }
    },
    [projectId, documentContent, whatIfInput, getHeaders]
  )

  function handleUseAsDirection(text: string) {
    onUseAsDirection(text)
    toast.success("已设为写作方向")
  }

  function handleRemoveGeneration(id: string) {
    setGenerations((prev) => prev.filter((g) => g.id !== id))
  }

  function handleClearAll() {
    setGenerations([])
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">灵感缪斯</h3>
        </div>
        {generations.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={handleClearAll}
          >
            <Trash2 className="h-3 w-3" />
            清空
          </Button>
        )}
      </div>

      <div className="space-y-3 border-b px-4 py-3">
        {/* What-if with optional input */}
        <div className="space-y-2">
          <Input
            placeholder="输入具体问题（选填）：假如主角失去了记忆..."
            value={whatIfInput}
            onChange={(e) => setWhatIfInput(e.target.value)}
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                callMuse("what-if")
              }
            }}
          />
        </div>

        {/* Mode buttons */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MODE_CONFIG) as MuseMode[]).map((mode) => {
            const config = MODE_CONFIG[mode]
            const Icon = config.icon
            const isActive = loading && activeMode === mode
            return (
              <Button
                key={mode}
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => callMuse(mode)}
                disabled={loading}
              >
                {isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                {config.label}
              </Button>
            )
          })}
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        {/* Streaming output */}
        {streamingText && (
          <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs font-medium text-primary">生成中...</span>
            </div>
            <div className="whitespace-pre-wrap text-xs leading-relaxed">
              {streamingText}
            </div>
          </div>
        )}

        {/* Generation history */}
        {generations.length === 0 && !streamingText ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">等待灵感降临</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              点击上方按钮激发创作灵感
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {generations.map((gen) => {
              const config = MODE_CONFIG[gen.mode]
              const Icon = config.icon
              return (
                <div
                  key={gen.id}
                  className="rounded-md border p-3"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">{config.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(gen.timestamp).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveGeneration(gen.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                  <div className="whitespace-pre-wrap text-xs leading-relaxed">
                    {gen.text}
                  </div>
                  <Separator className="my-2" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-[10px]"
                    onClick={() => handleUseAsDirection(gen.text)}
                  >
                    <ArrowRight className="h-2.5 w-2.5" />
                    用作写作方向
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
