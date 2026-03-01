"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useAIRecovery } from "@/hooks/use-ai-recovery"
import { RecoveryActionBar } from "@/components/ai/recovery-action-bar"
import { readAIStream } from "@/lib/ai/read-ai-stream"

interface MuseGeneration {
  id: string
  mode: "what-if" | "random-prompt" | "suggest"
  text: string
  timestamp: number
}

interface MusePanelProps {
  projectId: string
  documentId: string | null
  documentContent: string
  onUseAsDirection: (text: string) => void
  hasStyleSample: boolean
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
  documentId,
  documentContent,
  onUseAsDirection,
  hasStyleSample,
}: MusePanelProps) {
  const { getHeaders, config } = useAIConfigContext()
  const recovery = useAIRecovery({ config, getHeaders })
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState<MuseMode | null>(null)
  const [whatIfInput, setWhatIfInput] = useState("")
  const [generations, setGenerations] = useState<MuseGeneration[]>([])
  const [streamingText, setStreamingText] = useState("")
  const [proseModeOverride, setProseModeOverride] = useState("default")

  const fallbackToBalanced = proseModeOverride === "match-style" && !hasStyleSample
  const effectiveProseMode =
    proseModeOverride === "default"
      ? null
      : fallbackToBalanced
        ? "balanced"
        : proseModeOverride

  async function consumeMuseStream(reader: ReadableStreamDefaultReader<Uint8Array>, mode: MuseMode) {
    const fullText = await readAIStream(reader, setStreamingText)
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
  }

  const callMuse = useCallback(
    async (mode: MuseMode) => {
      setLoading(true)
      setActiveMode(mode)
      setStreamingText("")
      recovery.clearError()

      try {
        const body: Record<string, string> = {
          mode,
          projectId,
          documentId: documentId ?? "",
          context: documentContent.slice(-5000),
        }

        if (effectiveProseMode) {
          body.proseMode = effectiveProseMode
        }

        if (mode === "what-if" && whatIfInput.trim()) {
          body.input = whatIfInput.trim()
        }

        const endpoint = "/api/ai/muse"

        recovery.storeRequestContext(endpoint, body, async (reader) => {
          await consumeMuseStream(reader, mode)
        })

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getHeaders() },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          await recovery.handleResponseError(response)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          recovery.setError({
            errorType: "format_incompatible",
            message: "灵感返回为空响应，请重试或切换模型后继续写作。",
            retriable: true,
            suggestedActions: ["retry", "switch_model"],
            severity: "medium",
          })
          return
        }

        await consumeMuseStream(reader, mode)
      } catch (error) {
        recovery.handleFetchError(error)
      } finally {
        setLoading(false)
        setActiveMode(null)
      }
    },
    [projectId, documentId, documentContent, whatIfInput, effectiveProseMode, getHeaders, recovery]
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
        <Badge variant="secondary" className="text-[10px]">
          模式：
          {proseModeOverride === "default"
            ? "跟随故事圣经"
            : proseModeOverride === "balanced"
              ? "均衡"
              : proseModeOverride === "cinematic"
                ? "电影感"
                : proseModeOverride === "lyrical"
                  ? "抒情"
                  : proseModeOverride === "minimal"
                    ? "简洁"
                    : "匹配风格"}
        </Badge>
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
        <Select value={proseModeOverride} onValueChange={setProseModeOverride}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="选择灵感文风模式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default" className="text-xs">跟随故事圣经</SelectItem>
            <SelectItem value="balanced" className="text-xs">均衡</SelectItem>
            <SelectItem value="cinematic" className="text-xs">电影感</SelectItem>
            <SelectItem value="lyrical" className="text-xs">抒情</SelectItem>
            <SelectItem value="minimal" className="text-xs">简洁</SelectItem>
            <SelectItem value="match-style" className="text-xs">匹配风格</SelectItem>
          </SelectContent>
        </Select>
        {fallbackToBalanced ? (
          <p className="text-[11px] text-amber-700">
            当前项目缺少 style sample，已自动回落为“均衡”模式。
          </p>
        ) : null}

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

      {recovery.error ? (
        <div className="border-t px-4 py-2">
          <RecoveryActionBar
            error={recovery.error}
            onRetry={recovery.handleRetry}
            onSwitchModel={recovery.handleSwitchModel}
            onDismiss={recovery.clearError}
            isRetrying={recovery.isRetrying}
          />
        </div>
      ) : null}
    </div>
  )
}
