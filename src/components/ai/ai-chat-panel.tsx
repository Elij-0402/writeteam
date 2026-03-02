"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageSquare, Send, Loader2, User, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"
import { useAIRecovery } from "@/hooks/use-ai-recovery"
import { RecoveryActionBar } from "@/components/ai/recovery-action-bar"
import { readAIStream } from "@/lib/ai/read-ai-stream"
import { ChatSlashCommands } from "@/components/ai/chat-slash-commands"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface AIChatPanelProps {
  projectId: string
  documentId: string | null
  documentContent: string
  onInsertToEditor: (text: string) => void
  hasStyleSample: boolean
}

const PROSE_MODES = [
  { value: "default", label: "跟随故事圣经" },
  { value: "balanced", label: "均衡" },
  { value: "cinematic", label: "电影感" },
  { value: "lyrical", label: "抒情" },
  { value: "minimal", label: "简洁" },
  { value: "match-style", label: "匹配风格" },
] as const

export function AIChatPanel({
  projectId,
  documentId,
  documentContent,
  onInsertToEditor,
  hasStyleSample,
}: AIChatPanelProps) {
  const { getHeaders, config } = useAIConfigContext()
  const recovery = useAIRecovery({ config, getHeaders })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [proseModeOverride, setProseModeOverride] = useState("default")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fallbackToBalanced = proseModeOverride === "match-style" && !hasStyleSample
  const effectiveProseMode =
    proseModeOverride === "default"
      ? null
      : fallbackToBalanced
        ? "balanced"
        : proseModeOverride

  const slashMenuVisible = input.startsWith("/") && !loading

  async function handleSlashCommand(command: string) {
    setInput("")
    recovery.clearError()

    // /bible — just display a hint message, no API call
    if (command === "/bible") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: command },
        { role: "assistant", content: "请使用右侧面板中的「故事圣经」标签页查看或编辑故事圣经。" },
      ])
      return
    }

    // /visualize — non-streaming JSON endpoint
    if (command === "/visualize") {
      const userMsg: Message = { role: "user", content: "/visualize" }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)

      try {
        const body = {
          projectId,
          text: documentContent.slice(-2000),
          style: "realistic",
        }
        const response = await fetch("/api/ai/visualize", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getHeaders() },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const data = await response.json()
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `图片生成失败：${data.error || "未知错误"}` },
          ])
          return
        }

        const { imageUrl, prompt } = await response.json()
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `场景图片已生成。\n\nPrompt: ${prompt}\n\n图片链接: ${imageUrl}` },
        ])
      } catch (error) {
        recovery.handleFetchError(error)
      } finally {
        setLoading(false)
      }
      return
    }

    // /muse commands — streaming endpoint
    const museModeMap: Record<string, string> = {
      "/muse what-if": "what-if",
      "/muse random": "random-prompt",
      "/muse suggest": "suggest",
    }
    const museMode = museModeMap[command]
    if (museMode) {
      const userMsg: Message = { role: "user", content: command }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)

      const endpoint = "/api/ai/muse"
      const body: Record<string, string> = {
        mode: museMode,
        projectId,
        documentId: documentId ?? "",
        context: documentContent.slice(-5000),
      }

      if (effectiveProseMode) {
        body.proseMode = effectiveProseMode
      }

      recovery.storeRequestContext(endpoint, body, async (reader) => {
        setMessages((prev) => [...prev, { role: "assistant", content: "" }])
        await readAIStream(reader, (text) => {
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: "assistant", content: text }
            return updated
          })
        })
      })

      try {
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

        setMessages((prev) => [...prev, { role: "assistant", content: "" }])
        await readAIStream(reader, (text) => {
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: "assistant", content: text }
            return updated
          })
        })
      } catch (error) {
        recovery.handleFetchError(error)
      } finally {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: "user", content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)
    recovery.clearError()

    const endpoint = "/api/ai/chat"
    const body = {
      messages: [...messages, userMessage],
      projectId,
      documentId,
      context: documentContent.slice(-3000),
      proseMode: effectiveProseMode,
    }

    // Store request context for recovery
    recovery.storeRequestContext(endpoint, body, async (reader) => {
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])
      await readAIStream(reader, (text) => {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "assistant", content: text }
          return updated
        })
      })
    })

    try {
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
          message: "AI 返回为空响应，请重试或切换模型后继续写作。",
          retriable: true,
          suggestedActions: ["retry", "switch_model"],
          severity: "medium",
        })
        return
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }])
      await readAIStream(reader, (text) => {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: "assistant",
            content: text,
          }
          return updated
        })
      })
    } catch (error) {
      recovery.handleFetchError(error)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      // Don't send when slash command menu is open — user selects via click
      if (slashMenuVisible) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">AI 对话</h3>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          模式：{PROSE_MODES.find((item) => item.value === proseModeOverride)?.label ?? "跟随故事圣经"}
        </Badge>
      </div>

      <div className="border-b px-4 py-2 space-y-2">
        <Select value={proseModeOverride} onValueChange={setProseModeOverride}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="选择对话文风模式" />
          </SelectTrigger>
          <SelectContent>
            {PROSE_MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value} className="text-xs">
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fallbackToBalanced && (
          <p className="text-[11px] text-amber-700">
            当前项目缺少 style sample，已自动回落为“均衡”模式。
          </p>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">与 AI 写作助手对话</p>
            <p className="mt-1 text-xs text-muted-foreground">
              可询问角色、情节，或获取写作建议。
              AI 会结合当前文档上下文回答。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      AI
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {message.content}
                    {loading && i === messages.length - 1 && message.role === "assistant" && !message.content && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                  {message.role === "assistant" && message.content ? (
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px]"
                        onClick={() => onInsertToEditor(message.content)}
                      >
                        插入正文
                      </Button>
                    </div>
                  ) : null}
                </div>
                {message.role === "user" && (
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-xs">
                      <User className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Recovery Action Bar */}
      {recovery.error && (
        <div className="border-t px-4 py-2">
          <RecoveryActionBar
            error={recovery.error}
            onRetry={recovery.handleRetry}
            onSwitchModel={recovery.handleSwitchModel}
            onDismiss={recovery.clearError}
            isRetrying={recovery.isRetrying}
          />
        </div>
      )}

      {/* Input */}
      <div className="relative border-t p-4">
        <ChatSlashCommands
          input={input}
          onSelect={handleSlashCommand}
          visible={slashMenuVisible}
        />
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder="问问你的故事... 输入 / 查看命令"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="min-h-[60px] resize-none text-sm"
          />
          <Button
            size="icon"
            className="h-[60px] w-10 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            aria-label="发送"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
