"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageSquare, Send, Loader2, User, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"
import { useAIRecovery } from "@/hooks/use-ai-recovery"
import { RecoveryActionBar } from "@/components/ai/recovery-action-bar"
import { readAIStream } from "@/lib/ai/read-ai-stream"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface AIChatPanelProps {
  projectId: string
  documentContent: string
}

export function AIChatPanel({ projectId, documentContent }: AIChatPanelProps) {
  const { getHeaders, config } = useAIConfigContext()
  const recovery = useAIRecovery({ config, getHeaders })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      context: documentContent.slice(-3000),
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

      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      if (reader) {
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
      }
    } catch (error) {
      recovery.handleFetchError(error)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
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
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder="问问你的故事..."
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
