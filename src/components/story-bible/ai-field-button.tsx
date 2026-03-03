"use client"

import { useState } from "react"
import { Sparkles, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"

interface AIFieldButtonProps {
  projectId: string
  targetField: string
  currentBible: Record<string, unknown>
  onAccept: (value: string) => void
}

export function AIFieldButton({
  projectId,
  targetField,
  currentBible,
  onAccept,
}: AIFieldButtonProps) {
  const { config, getHeaders } = useAIConfigContext()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!config?.apiKey || !config?.baseUrl) return
    setLoading(true)
    setPreview(null)

    try {
      const response = await fetch("/api/ai/bible-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getHeaders(),
        },
        body: JSON.stringify({
          projectId,
          mode: "field-generate",
          targetField,
          currentBible,
        }),
      })

      if (!response.ok || !response.body) throw new Error("请求失败")

      // Read the stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let result = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += decoder.decode(value, { stream: true })
      }
      setPreview(result.trim())
    } catch {
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  if (preview !== null) {
    return (
      <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2">
        <p className="text-xs text-muted-foreground">AI 建议：</p>
        <p className="text-sm whitespace-pre-wrap">{preview}</p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="default"
            className="h-6 text-xs"
            onClick={() => {
              onAccept(preview)
              setPreview(null)
            }}
          >
            <Check className="mr-1 h-3 w-3" />
            采纳
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => setPreview(null)}
          >
            <X className="mr-1 h-3 w-3" />
            丢弃
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 gap-1 text-xs text-muted-foreground hover:text-primary"
      onClick={handleGenerate}
      disabled={loading || !config?.apiKey}
      title={!config?.apiKey ? "请先配置 AI 密钥" : "AI 生成建议"}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      AI 生成
    </Button>
  )
}
