"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  PenLine,
  Wand2,
  Eye,
  Brain,
  Expand,
  FileText,
  ListTree,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Minimize2,
  Shuffle,
  Palette,
  Zap,
  Lightbulb,
  Puzzle,
  Image as ImageIcon,
  Settings,
} from "lucide-react"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"
import { useAIRecovery } from "@/hooks/use-ai-recovery"
import { RecoveryActionBar } from "@/components/ai/recovery-action-bar"
import { readAIStream } from "@/lib/ai/read-ai-stream"
import { AI_TTFB_MS } from "@/lib/ai/timing"
import { parseContinuityResult, type ContinuityIssue, type ContinuityResult } from "@/lib/ai/continuity-result"
import type { ErrorClassification } from "@/lib/ai/error-classification"
import type { Plugin } from "@/types/database"

interface AIToolbarProps {
  selectedText: string
  documentContent: string
  projectId: string
  documentId: string
  onInsertText: (text: string) => void
  onReplaceSelection?: (text: string) => void
  plugins?: Plugin[]
  onToggleMuse?: () => void
  onToggleVisualizePanel?: () => void
  onOpenPluginManager?: () => void
  saliencyData?: { activeCharacters: string[]; activeLocations: string[]; activePlotlines: string[] } | null
}

type AIFeature =
  | "write"
  | "rewrite"
  | "describe"
  | "brainstorm"
  | "expand"
  | "first-draft"
  | "scene-plan"
  | "continuity-check"
  | "shrink"
  | "twist"
  | "tone-shift"
  | "quick-edit"
  | "plugin"

const WRITE_MODES = [
  { value: "auto", label: "自动 - AI 决定" },
  { value: "guided", label: "引导 - 由你指定" },
  { value: "tone-ominous", label: "语气：阴郁" },
  { value: "tone-romantic", label: "语气：浪漫" },
  { value: "tone-fast", label: "语气：快节奏" },
  { value: "tone-humorous", label: "语气：幽默" },
]

const REWRITE_MODES = [
  { value: "rephrase", label: "改写" },
  { value: "shorter", label: "精简" },
  { value: "longer", label: "扩写" },
  { value: "show-not-tell", label: "展示而非告知" },
  { value: "more-intense", label: "更强烈" },
  { value: "more-lyrical", label: "更抒情" },
  { value: "custom", label: "自定义指令" },
]

const PROSE_MODES = [
  { value: "default", label: "跟随故事圣经模式" },
  { value: "balanced", label: "均衡" },
  { value: "cinematic", label: "电影感" },
  { value: "lyrical", label: "抒情" },
  { value: "minimal", label: "简洁" },
  { value: "match-style", label: "匹配风格" },
]

const TONE_SHIFT_OPTIONS = [
  { value: "tense", label: "紧张" },
  { value: "tender", label: "温柔" },
  { value: "humorous", label: "幽默" },
  { value: "melancholic", label: "悲伤" },
  { value: "angry", label: "愤怒" },
  { value: "mysterious", label: "神秘" },
]

export function AIToolbar({
  selectedText,
  documentContent,
  projectId,
  documentId,
  onInsertText,
  onReplaceSelection,
  plugins = [],
  onToggleMuse,
  onToggleVisualizePanel,
  onOpenPluginManager,
  saliencyData,
}: AIToolbarProps) {
  const { isConfigured, getHeaders, config } = useAIConfigContext()
  const recovery = useAIRecovery({ config, getHeaders })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState("")
  const [activeFeature, setActiveFeature] = useState<AIFeature | null>(null)
  const [writeMode, setWriteMode] = useState("auto")
  const [rewriteMode, setRewriteMode] = useState("rephrase")
  const [customPrompt, setCustomPrompt] = useState("")
  const [guidedPrompt, setGuidedPrompt] = useState("")
  const [brainstormTopic, setBrainstormTopic] = useState("")
  const [firstDraftOutline, setFirstDraftOutline] = useState("")
  const [scenePlanGoal, setScenePlanGoal] = useState("")
  const [continuityPassage, setContinuityPassage] = useState("")
  const [proseModeOverride, setProseModeOverride] = useState("default")
  const [selectedTone, setSelectedTone] = useState("tense")
  const [copied, setCopied] = useState(false)
  const [responseFingerprint, setResponseFingerprint] = useState("")
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<0 | 1 | -1>(0)
  const [quickEditInstruction, setQuickEditInstruction] = useState("")
  const [pluginInput, setPluginInput] = useState("")
  const [continuityResult, setContinuityResult] = useState<ContinuityResult | null>(null)

  async function hashText(text: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }

  async function callAI(feature: AIFeature, extraBody?: Record<string, unknown>) {
    setLoading(true)
    setActiveFeature(feature)
    setResult("")
    setContinuityResult(null)
    setCopied(false)
    setResponseFingerprint("")
    setFeedbackGiven(0)
    recovery.clearError()

    try {
      const body: Record<string, unknown> = {
        projectId,
        documentId,
        context: documentContent.slice(-5000),
      }

      if (proseModeOverride !== "default") {
        body.proseMode = proseModeOverride
      }

      if (saliencyData) {
        body.saliency = saliencyData
      }

      if (extraBody) {
        Object.assign(body, extraBody)
      }

      switch (feature) {
        case "write":
          body.mode = writeMode
          body.guidance = guidedPrompt
          break
        case "rewrite":
          body.text = selectedText
          body.mode = rewriteMode
          body.customInstructions = customPrompt
          break
        case "describe":
          body.text = selectedText || "该场景"
          break
        case "brainstorm":
          body.topic = brainstormTopic
          break
        case "expand":
          body.text = selectedText || documentContent.slice(-2000)
          break
        case "first-draft":
          body.outline = firstDraftOutline
          break
        case "scene-plan":
          body.goal = scenePlanGoal
          break
        case "continuity-check":
          body.passage = continuityPassage || selectedText || documentContent.slice(-2000)
          break
        case "shrink":
          body.text = selectedText
          break
        case "twist":
          break
        case "tone-shift":
          body.text = selectedText
          body.tone = selectedTone
          break
        case "quick-edit":
          body.text = selectedText
          body.instruction = quickEditInstruction
          break
      }

      const endpoint = feature === "plugin" ? "/api/ai/plugin" : `/api/ai/${feature}`

      // Store request context for recovery retry
      recovery.storeRequestContext(endpoint, body, async (reader) => {
        let streamEventError: ErrorClassification | null = null
        const fullText = await readAIStream(reader, setResult, {
          onErrorEvent: (event) => {
            streamEventError = {
              errorType:
                event.errorType === "auth" ||
                event.errorType === "model_not_found" ||
                event.errorType === "rate_limit" ||
                event.errorType === "timeout" ||
                event.errorType === "provider_unavailable" ||
                event.errorType === "server_error" ||
                event.errorType === "network" ||
                event.errorType === "format_incompatible"
                  ? event.errorType
                  : "unknown",
              message: event.error,
              retriable: event.retriable ?? true,
              suggestedActions:
                event.suggestedActions?.filter(
                  (item): item is "retry" | "switch_model" | "check_config" | "wait_and_retry" =>
                    item === "retry" ||
                    item === "switch_model" ||
                    item === "check_config" ||
                    item === "wait_and_retry"
                ) ?? ["retry", "switch_model"],
              severity: "medium",
            }
          },
        })
        if (streamEventError) {
          recovery.setError(streamEventError)
        }
        if (feature === "continuity-check") {
          setContinuityResult(parseContinuityResult(fullText))
        }
        if (fullText) {
          const fingerprint = await hashText(fullText)
          setResponseFingerprint(fingerprint)
        }
      })

      const ttfbController = new AbortController()
      const ttfbTimer = setTimeout(() => ttfbController.abort(), AI_TTFB_MS)
      let firstChunkReceived = false

      let response: Response
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getHeaders() },
          body: JSON.stringify(body),
          signal: ttfbController.signal,
        })
      } catch (error) {
        clearTimeout(ttfbTimer)
        throw error
      }

      if (!response.ok) {
        clearTimeout(ttfbTimer)
        await recovery.handleResponseError(response)
        return
      }

      const reader = response.body?.getReader()
      if (reader) {
        let streamEventError: ErrorClassification | null = null
        const fullText = await readAIStream(reader, setResult, {
          onFirstChunk: () => {
            if (!firstChunkReceived) {
              firstChunkReceived = true
              clearTimeout(ttfbTimer)
            }
          },
          onErrorEvent: (event) => {
            streamEventError = {
              errorType:
                event.errorType === "auth" ||
                event.errorType === "model_not_found" ||
                event.errorType === "rate_limit" ||
                event.errorType === "timeout" ||
                event.errorType === "provider_unavailable" ||
                event.errorType === "server_error" ||
                event.errorType === "network" ||
                event.errorType === "format_incompatible"
                  ? event.errorType
                  : "unknown",
              message: event.error,
              retriable: event.retriable ?? true,
              suggestedActions:
                event.suggestedActions?.filter(
                  (item): item is "retry" | "switch_model" | "check_config" | "wait_and_retry" =>
                    item === "retry" ||
                    item === "switch_model" ||
                    item === "check_config" ||
                    item === "wait_and_retry"
                ) ?? ["retry", "switch_model"],
              severity: "medium",
            }
          },
        })
        clearTimeout(ttfbTimer)
        if (streamEventError) {
          recovery.setError(streamEventError)
        }
        if (feature === "continuity-check") {
          setContinuityResult(parseContinuityResult(fullText))
        }
        if (fullText) {
          const fingerprint = await hashText(fullText)
          setResponseFingerprint(fingerprint)
        }
      } else {
        clearTimeout(ttfbTimer)
      }
    } catch (error) {
      recovery.handleFetchError(error)
    } finally {
      setLoading(false)
    }
  }

  async function callPlugin(plugin: Plugin) {
    await callAI("plugin", {
      pluginId: plugin.id,
      text: selectedText,
      input: pluginInput,
    })
  }

  function handleReplace() {
    if (result && onReplaceSelection && selectedText) {
      onReplaceSelection(result)
      setResult("")
      setContinuityResult(null)
      setActiveFeature(null)
      toast.success("已替换选中文本")
    }
  }

  function handleInsert() {
    if (result) {
      onInsertText(result)
      setResult("")
      setContinuityResult(null)
      setActiveFeature(null)
      toast.success("文本已插入编辑器")
    }
  }

  function handleInsertContinuityIssue(issue: ContinuityIssue) {
    onInsertText(issue.insertionText)
    toast.success("建议已插入编辑器")
  }

  function handleReplaceContinuityIssue(issue: ContinuityIssue) {
    if (!selectedText || !onReplaceSelection) {
      return
    }
    onReplaceSelection(issue.replacementText)
    toast.success("建议已替换选区")
  }

  function handleCopyContinuityIssue(issue: ContinuityIssue) {
    navigator.clipboard.writeText(issue.fix)
    toast.success("建议已复制到剪贴板")
  }

  function handleUseScenePlanAsDraft() {
    if (!result) {
      return
    }

    setFirstDraftOutline(result)
    setResult("")
    setActiveFeature("first-draft")
    toast.success("场景规划已填入首稿输入")
  }

  function handleCopy() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    toast.success("已复制到剪贴板")
    setTimeout(() => setCopied(false), 2000)
  }

  async function submitFeedback(rating: 1 | -1) {
    if (!activeFeature || !responseFingerprint || feedbackLoading || feedbackGiven !== 0) {
      return
    }

    setFeedbackLoading(true)
    try {
      const response = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          feature: activeFeature,
          responseFingerprint,
          rating,
        }),
      })

      if (!response.ok) {
        let errorMessage = "提交反馈失败"
        let errorCode = ""
        let existingRating: 1 | -1 | null = null

        const data = (await response.json().catch(() => null)) as
          | null
          | { error?: string; existingRating?: unknown }
          | { error?: { code?: string; message?: string }; existingRating?: unknown }

        if (data && typeof data === "object") {
          if ("existingRating" in data && (data.existingRating === 1 || data.existingRating === -1)) {
            existingRating = data.existingRating
          }

          if ("error" in data && typeof data.error === "string") {
            errorMessage = data.error
          } else if ("error" in data && data.error && typeof data.error === "object") {
            errorCode = typeof data.error.code === "string" ? data.error.code : ""
            if (typeof data.error.message === "string" && data.error.message) {
              errorMessage = data.error.message
            }
          }
        }

        if (errorCode === "ALREADY_RATED") {
          setFeedbackGiven(existingRating ?? rating)
          toast.success("该结果已反馈过")
          return
        }

        throw new Error(errorMessage)
      }

      setFeedbackGiven(rating)
      toast.success(rating === 1 ? "已标记为有帮助" : "已标记为无帮助")
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交反馈失败"
      toast.error(`${message}，请重试或稍后再试`)
    } finally {
      setFeedbackLoading(false)
    }
  }

  return (
    <div className="flex flex-col">
      {!isConfigured && (
        <div className="flex items-center gap-2 border-b bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
          <Settings className="h-3.5 w-3.5 shrink-0" />
          <span>AI 服务未配置</span>
          <a href="/settings" className="underline font-medium hover:no-underline">前往设置</a>
        </div>
      )}
      <div className="flex items-center gap-1 border-b bg-muted/30 px-3 py-1.5 overflow-x-auto">
      {/* Write */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0">
                <PenLine className="h-3.5 w-3.5" />
                续写
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>使用 AI 继续写作</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">AI 续写</h4>
            <p className="text-xs text-muted-foreground">
              AI 会从当前进度继续你的故事。
            </p>
            <Select value={writeMode} onValueChange={setWriteMode}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WRITE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {writeMode === "guided" && (
              <Textarea
                placeholder="接下来会发生什么？例如：他们在书架后发现一扇暗门"
                value={guidedPrompt}
                onChange={(e) => setGuidedPrompt(e.target.value)}
                rows={3}
                className="text-xs"
              />
            )}
            <Select value={proseModeOverride} onValueChange={setProseModeOverride}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="覆盖文风模式" />
              </SelectTrigger>
              <SelectContent>
                {PROSE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("write")}
              disabled={loading || !isConfigured}
            >
              {loading && activeFeature === "write" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-3.5 w-3.5" />
              )}
              生成
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0">
                <ListTree className="h-3.5 w-3.5" />
                场景规划
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>规划章节场景与节拍</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">场景规划</h4>
            <Textarea
              placeholder="章节目标与预期结果..."
              value={scenePlanGoal}
              onChange={(e) => setScenePlanGoal(e.target.value)}
              rows={4}
              className="text-xs"
            />
            <Select value={proseModeOverride} onValueChange={setProseModeOverride}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="覆盖文风模式" />
              </SelectTrigger>
              <SelectContent>
                {PROSE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("scene-plan")}
              disabled={loading || !scenePlanGoal}
            >
              {loading && activeFeature === "scene-plan" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListTree className="mr-2 h-3.5 w-3.5" />
              )}
              生成场景规划
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0">
                <ShieldAlert className="h-3.5 w-3.5" />
                连贯性
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>检查逻辑与连贯性</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">连贯性检查</h4>
            <Textarea
              placeholder="粘贴要检查的段落。留空则使用选中文本或最近上下文。"
              value={continuityPassage}
              onChange={(e) => setContinuityPassage(e.target.value)}
              rows={4}
              className="text-xs"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("continuity-check")}
              disabled={loading || (!continuityPassage && !selectedText && !documentContent)}
            >
              {loading && activeFeature === "continuity-check" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="mr-2 h-3.5 w-3.5" />
              )}
              运行连贯性检查
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Rewrite */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs shrink-0"
                disabled={!selectedText}
              >
                <Wand2 className="h-3.5 w-3.5" />
                改写
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {selectedText ? "改写选中文本" : "请先选择文本"}
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">改写</h4>
            <p className="text-xs text-muted-foreground">
              已选：{selectedText.slice(0, 100)}
              {selectedText.length > 100 ? "..." : ""}
            </p>
            <Select value={rewriteMode} onValueChange={setRewriteMode}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REWRITE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rewriteMode === "custom" && (
              <Textarea
                placeholder="自定义改写指令..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={2}
                className="text-xs"
              />
            )}
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("rewrite")}
              disabled={loading}
            >
              {loading && activeFeature === "rewrite" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-3.5 w-3.5" />
              )}
              开始改写
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Edit */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs shrink-0"
                disabled={!selectedText}
              >
                <Zap className="h-3.5 w-3.5" />
                快编
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {selectedText ? "自然语言指令编辑" : "请先选择文本"}
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">快速编辑</h4>
            <p className="text-xs text-muted-foreground">
              输入自然语言指令来编辑选中文本。
            </p>
            <Input
              placeholder="例：改得更悬疑、增加对话、缩短为一句话..."
              value={quickEditInstruction}
              onChange={(e) => setQuickEditInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && quickEditInstruction.trim()) {
                  callAI("quick-edit")
                }
              }}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("quick-edit")}
              disabled={loading || !quickEditInstruction.trim() || !selectedText}
            >
              {loading && activeFeature === "quick-edit" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="mr-2 h-3.5 w-3.5" />
              )}
              执行编辑
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Describe */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={() => callAI("describe")}
            disabled={loading || !selectedText}
          >
            {loading && activeFeature === "describe" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            描写
          </Button>
        </TooltipTrigger>
        <TooltipContent>生成感官描写</TooltipContent>
      </Tooltip>

      {/* Brainstorm */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0">
                <Brain className="h-3.5 w-3.5" />
                头脑风暴
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>生成灵感点子</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">头脑风暴</h4>
            <Textarea
              placeholder="你想获取哪方面点子？例如：奇幻城市名、悬疑反转"
              value={brainstormTopic}
              onChange={(e) => setBrainstormTopic(e.target.value)}
              rows={3}
              className="text-xs"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("brainstorm")}
              disabled={loading || !brainstormTopic}
            >
              {loading && activeFeature === "brainstorm" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Brain className="mr-2 h-3.5 w-3.5" />
              )}
              生成点子
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Twist */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={() => callAI("twist")}
            disabled={loading}
          >
            {loading && activeFeature === "twist" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Shuffle className="h-3.5 w-3.5" />
            )}
            情节反转
          </Button>
        </TooltipTrigger>
        <TooltipContent>生成情节反转建议</TooltipContent>
      </Tooltip>

      {/* Expand */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={() => callAI("expand")}
            disabled={loading}
          >
            {loading && activeFeature === "expand" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Expand className="h-3.5 w-3.5" />
            )}
            扩写
          </Button>
        </TooltipTrigger>
        <TooltipContent>扩展文本并增加细节</TooltipContent>
      </Tooltip>

      {/* Shrink */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={() => callAI("shrink")}
            disabled={loading || !selectedText}
          >
            {loading && activeFeature === "shrink" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
            压缩
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {selectedText ? "精简压缩选中文本" : "请先选择文本"}
        </TooltipContent>
      </Tooltip>

      {/* Tone Shift */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs shrink-0"
                disabled={!selectedText}
              >
                <Palette className="h-3.5 w-3.5" />
                语调转换
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {selectedText ? "转换选中文本语调" : "请先选择文本"}
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">语调转换</h4>
            <p className="text-xs text-muted-foreground">
              已选：{selectedText.slice(0, 100)}
              {selectedText.length > 100 ? "..." : ""}
            </p>
            <Select value={selectedTone} onValueChange={setSelectedTone}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_SHIFT_OPTIONS.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value} className="text-xs">
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("tone-shift")}
              disabled={loading}
            >
              {loading && activeFeature === "tone-shift" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Palette className="mr-2 h-3.5 w-3.5" />
              )}
              转换语调
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* First Draft */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0">
                <FileText className="h-3.5 w-3.5" />
                首稿
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>根据大纲生成完整场景</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">首稿</h4>
            <p className="text-xs text-muted-foreground">
              提供大纲或节拍，AI 将生成完整场景。
            </p>
            <Select value={proseModeOverride} onValueChange={setProseModeOverride}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="覆盖文风模式" />
              </SelectTrigger>
              <SelectContent>
                {PROSE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="text-xs">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="场景节拍：&#10;- 角色到达废弃宅邸&#10;- 探索门厅并发现诡异画像&#10;- 楼上传来异响..."
              value={firstDraftOutline}
              onChange={(e) => setFirstDraftOutline(e.target.value)}
              rows={6}
              className="text-xs"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => callAI("first-draft")}
              disabled={loading || !firstDraftOutline}
            >
              {loading && activeFeature === "first-draft" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="mr-2 h-3.5 w-3.5" />
              )}
              生成首稿
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Plugins */}
      {plugins.length > 0 && (
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0">
                  <Puzzle className="h-3.5 w-3.5" />
                  插件
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>运行自定义 AI 插件</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">AI 插件</h4>
              <Input
                placeholder="输入内容（可选）..."
                value={pluginInput}
                onChange={(e) => setPluginInput(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="space-y-1">
                {plugins.map((plugin) => (
                  <Button
                    key={plugin.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs gap-2"
                    onClick={() => callPlugin(plugin)}
                    disabled={loading || (plugin.requires_selection && !selectedText)}
                  >
                    <span>{plugin.icon || "🔌"}</span>
                    {plugin.name}
                  </Button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Separator + Right-side tools */}
      <div className="ml-auto flex items-center gap-1 shrink-0">
        {/* Muse */}
        {onToggleMuse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={onToggleMuse}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                灵感
              </Button>
            </TooltipTrigger>
            <TooltipContent>打开 Muse 灵感面板</TooltipContent>
          </Tooltip>
        )}

        {/* Visualize */}
        {onToggleVisualizePanel && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={onToggleVisualizePanel}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                可视化
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI 图片生成</TooltipContent>
          </Tooltip>
        )}

        {/* Plugin Manager */}
        {onOpenPluginManager && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={onOpenPluginManager}
              >
                <Puzzle className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>管理插件</TooltipContent>
          </Tooltip>
        )}

        {/* Settings Link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => window.open("/settings", "_blank")}
            >
              <Settings className="h-3.5 w-3.5" />
              {isConfigured ? (config?.modelName || config?.modelId || "已配置") : "未配置"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isConfigured ? "AI 设置" : "点击前往配置 AI 服务"}</TooltipContent>
        </Tooltip>
      </div>

      {/* Result Panel */}
      {result && (
        <Popover open={!!result} onOpenChange={(open) => {
          if (!open) {
            setResult("")
            setContinuityResult(null)
          }
        }}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" className="ml-2 h-8 gap-1.5 text-xs shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
              查看结果
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px]" align="end" side="bottom">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">AI 结果</h4>
              {activeFeature === "continuity-check" && continuityResult ? (
                <ScrollArea className="max-h-[320px]">
                  <div className="space-y-3 text-sm">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="font-medium">{continuityResult.summary}</p>
                    </div>
                    {continuityResult.issues.length > 0 ? (
                      continuityResult.issues.map((issue, index) => (
                        <div key={`${issue.issue}-${index}`} className="space-y-2 rounded-md border p-3">
                          {issue.evidenceSource === "未知" && (
                            <div className="rounded-md border border-orange-300 bg-orange-50 px-2 py-1 text-xs text-orange-700">
                              当前建议缺少可信来源标注，请重试连贯性检查后再应用。
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{issue.type}</Badge>
                            <Badge variant="outline">{issue.evidenceSource}</Badge>
                          </div>
                          <p><span className="font-medium">问题：</span>{issue.issue}</p>
                          <p><span className="font-medium">原因：</span>{issue.reason}</p>
                          <p><span className="font-medium">证据：</span>{issue.evidence}</p>
                          <p><span className="font-medium">建议：</span>{issue.fix}</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleInsertContinuityIssue(issue)}
                              disabled={issue.evidenceSource === "未知"}
                            >
                              插入建议
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReplaceContinuityIssue(issue)}
                              disabled={!selectedText || !onReplaceSelection || issue.evidenceSource === "未知"}
                            >
                              按建议替换选区
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCopyContinuityIssue(issue)}>
                              复制建议
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border bg-muted/20 p-2 text-muted-foreground">
                        {continuityResult.raw}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {result}
                  </div>
                </ScrollArea>
              )}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={handleInsert}>
                  插入编辑器
                </Button>
                {selectedText && onReplaceSelection && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={handleReplace}>
                    替换选区
                  </Button>
                )}
                {activeFeature === "scene-plan" && (
                  <Button size="sm" variant="outline" onClick={handleUseScenePlanAsDraft}>
                    用作首稿输入
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant={feedbackGiven === 1 ? "default" : "outline"}
                  aria-label="反馈有帮助"
                  onClick={() => submitFeedback(1)}
                  disabled={feedbackLoading || feedbackGiven !== 0 || !responseFingerprint}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={feedbackGiven === -1 ? "default" : "outline"}
                  aria-label="反馈无帮助"
                  onClick={() => submitFeedback(-1)}
                  disabled={feedbackLoading || feedbackGiven !== 0 || !responseFingerprint}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>

      {/* Recovery Action Bar */}
      {recovery.error && (
        <div className="border-t px-3 py-2">
          <RecoveryActionBar
            error={recovery.error}
            onRetry={recovery.handleRetry}
            onSwitchModel={recovery.handleSwitchModel}
            onDismiss={recovery.clearError}
            isRetrying={recovery.isRetrying}
          />
        </div>
      )}
    </div>
  )
}
