"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, ArrowRightLeft, X, Loader2 } from "lucide-react"
import { PROVIDER_PRESETS } from "@/lib/ai/ai-config"
import type { ErrorClassification } from "@/lib/ai/error-classification"

interface RecoveryActionBarProps {
  error: ErrorClassification
  onRetry: () => void
  onSwitchModel: (modelId: string, baseUrl?: string) => void
  onDismiss: () => void
  isRetrying: boolean
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  auth: "认证失败",
  model_not_found: "模型不存在",
  rate_limit: "频率限制",
  timeout: "连接超时",
  provider_unavailable: "服务不可达",
  server_error: "服务端错误",
  network: "网络异常",
  format_incompatible: "格式不兼容",
  unknown: "未知错误",
}

const SEVERITY_VARIANT: Record<string, "destructive" | "default" | "secondary"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
}

export function RecoveryActionBar({
  error,
  onRetry,
  onSwitchModel,
  onDismiss,
  isRetrying,
}: RecoveryActionBarProps) {
  const [showSwitchPanel, setShowSwitchPanel] = useState(false)
  const [customModelId, setCustomModelId] = useState("")

  // H1 fix: Escape key closes the recovery bar (WCAG 2.1 AA)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isRetrying) {
        onDismiss()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onDismiss, isRetrying])

  function handleSwitchPreset(baseUrl: string) {
    if (!customModelId.trim()) return
    onSwitchModel(customModelId.trim(), baseUrl)
  }

  function handleCustomSwitch() {
    if (!customModelId.trim()) return
    onSwitchModel(customModelId.trim())
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
      <CardContent className="p-4 space-y-3">
        {/* Error description */}
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">AI 请求失败</span>
              <Badge variant={SEVERITY_VARIANT[error.severity] ?? "default"}>
                {ERROR_TYPE_LABELS[error.errorType] ?? error.errorType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {error.retriable && (
            <Button
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isRetrying ? "重试中..." : "重试"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSwitchPanel(!showSwitchPanel)}
            disabled={isRetrying}
          >
            <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
            切换模型
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            disabled={isRetrying}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            继续写作
          </Button>
        </div>

        {/* Switch model panel */}
        {showSwitchPanel && (
          <div className="border rounded-md p-3 space-y-2 bg-background">
            <p className="text-xs text-muted-foreground">输入 Model ID 后选择 Provider 发起重试：</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="输入 Model ID，如 deepseek-chat"
                value={customModelId}
                onChange={(e) => setCustomModelId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customModelId.trim()) {
                    handleCustomSwitch()
                  }
                }}
                className="h-8 text-xs flex-1"
                disabled={isRetrying}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PROVIDER_PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleSwitchPreset(preset.baseUrl)}
                  disabled={isRetrying || !customModelId.trim()}
                >
                  {preset.name}
                </Button>
              ))}
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleCustomSwitch}
                disabled={isRetrying || !customModelId.trim()}
              >
                使用当前 Provider 重试
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
