"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, RefreshCw, XCircle } from "lucide-react"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildConfigHeaders, PROVIDER_PRESETS } from "@/lib/ai/ai-config"
import type { AIProviderConfig } from "@/lib/ai/ai-config"

type ActionKind = "config_check" | "switch_model" | "retry" | "preserve_context"
type ExecutionStatus = "pending" | "done" | "failed"

interface RunbookAction {
  id: string
  kind: ActionKind
  title: string
  action: string
  expected: string
  onFailure: string
  fallback: string
}

interface RunbookTemplate {
  precheck: string[]
  diagnosis: string[]
  recovery_actions: RunbookAction[]
  verify: string[]
  escalation: string[]
}

interface RunbookData {
  primaryErrorType: string
  errorTypes: string[]
  input?: {
    contextRef?: string
  }
  template: RunbookTemplate
}

interface SuccessEnvelope {
  success: true
  data: RunbookData
}

interface ErrorEnvelope {
  success: false
  error: {
    code: string
    message: string
  }
}

type ApiEnvelope = SuccessEnvelope | ErrorEnvelope

const PROVIDER_OPTIONS = ["OpenAI", "DeepSeek", "OpenRouter", "硅基流动", "Ollama"]

const ACTION_KIND_LABEL: Record<ActionKind, string> = {
  config_check: "配置检查",
  switch_model: "模型切换",
  retry: "重试",
  preserve_context: "上下文保留",
}

const STATUS_LABEL: Record<ExecutionStatus, string> = {
  pending: "未执行",
  done: "已执行",
  failed: "执行失败",
}

const STATUS_BADGE_VARIANT: Record<ExecutionStatus, "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  done: "default",
  failed: "destructive",
}

export function SupportRunbookPanel() {
  const { config, updateConfig } = useAIConfigContext()
  const [ticketText, setTicketText] = useState("")
  const [provider, setProvider] = useState("OpenAI")
  const [model, setModel] = useState("")
  const [contextRef, setContextRef] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RunbookData | null>(null)
  const [statuses, setStatuses] = useState<Record<string, ExecutionStatus>>({})
  const [executingActionId, setExecutingActionId] = useState<string | null>(null)

  const progress = useMemo(() => {
    const total = data?.template.recovery_actions.length ?? 0
    if (total === 0) {
      return { total: 0, done: 0, failed: 0 }
    }

    let done = 0
    let failed = 0
    for (const action of data?.template.recovery_actions ?? []) {
      const status = statuses[action.id] ?? "pending"
      if (status === "done") {
        done += 1
      }
      if (status === "failed") {
        failed += 1
      }
    }
    return { total, done, failed }
  }, [data, statuses])

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/ai/support-runbook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketText,
          targetProvider: provider,
          targetModel: model,
          contextRef,
          recentLimit: 20,
        }),
      })

      const envelope = (await response.json()) as ApiEnvelope
      if (!response.ok || !envelope.success) {
        const message = envelope.success ? "Runbook 生成失败" : envelope.error.message
        setError(message)
        setData(null)
        setStatuses({})
        return
      }

      setData(envelope.data)
      setContextRef(envelope.data.input?.contextRef ?? contextRef)
      const initialStatuses: Record<string, ExecutionStatus> = {}
      for (const action of envelope.data.template.recovery_actions) {
        initialStatuses[action.id] = "pending"
      }
      setStatuses(initialStatuses)
    } catch {
      setError("Runbook 生成失败")
      setData(null)
      setStatuses({})
    } finally {
      setLoading(false)
    }
  }

  function updateStatus(actionId: string, status: ExecutionStatus) {
    setStatuses((prev) => ({
      ...prev,
      [actionId]: status,
    }))
  }

  function buildConfigForAction(currentConfig: AIProviderConfig): AIProviderConfig {
    const providerPreset = PROVIDER_PRESETS.find((item) => item.name === provider)
    const resolvedModel = model.trim() || currentConfig.modelId

    return {
      ...currentConfig,
      baseUrl: providerPreset?.baseUrl ?? currentConfig.baseUrl,
      modelId: resolvedModel,
      modelName: resolvedModel,
      configuredAt: Date.now(),
    }
  }

  async function executeAction(action: RunbookAction) {
    setExecutingActionId(action.id)
    setError(null)

    try {
      if (action.kind === "preserve_context") {
        const snapshot = {
          ticketText,
          provider,
          model,
          contextRef,
        }
        localStorage.setItem("writeteam-runbook-context", JSON.stringify(snapshot))
        updateStatus(action.id, "done")
        return
      }

      if (action.kind === "retry") {
        const retryResponse = await fetch("/api/ai/support-runbook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ticketText,
            targetProvider: provider,
            targetModel: model,
            contextRef,
            recentLimit: 20,
          }),
        })

        const retryEnvelope = (await retryResponse.json()) as ApiEnvelope
        if (!retryResponse.ok || !retryEnvelope.success) {
          const message = retryEnvelope.success ? "重试失败" : retryEnvelope.error.message
          updateStatus(action.id, "failed")
          setError(message)
          return
        }

        setData(retryEnvelope.data)
        setContextRef(retryEnvelope.data.input?.contextRef ?? contextRef)
        const nextStatuses: Record<string, ExecutionStatus> = {}
        for (const item of retryEnvelope.data.template.recovery_actions) {
          nextStatuses[item.id] = "pending"
        }
        nextStatuses[action.id] = "done"
        setStatuses(nextStatuses)
        return
      }

      if (!config) {
        updateStatus(action.id, "failed")
        setError("请先在 AI 模型配置中保存可用的 Base URL、API Key 与模型")
        return
      }

      const effectiveConfig = action.kind === "switch_model" ? buildConfigForAction(config) : config
      if (action.kind === "switch_model") {
        updateConfig(effectiveConfig)
      }

      const response = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildConfigHeaders(effectiveConfig),
        },
      })

      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) {
        updateStatus(action.id, "failed")
        setError(result.error || "动作执行失败，请检查配置后重试")
        return
      }

      updateStatus(action.id, "done")
    } catch {
      updateStatus(action.id, "failed")
      setError("动作执行失败，请检查配置后重试")
    } finally {
      setExecutingActionId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle>支持排障建议与恢复 Runbook</CardTitle>
          </div>
          <Badge variant="outline">Support</Badge>
        </div>
        <CardDescription>输入工单上下文并生成可执行恢复动作，覆盖配置检查、模型切换、重试与上下文保留。</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="runbook-ticket">工单/错误上下文</Label>
            <Input
              id="runbook-ticket"
              placeholder="输入工单错误文本或失败上下文"
              value={ticketText}
              onChange={(event) => setTicketText(event.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="runbook-context-ref">上下文标识（可选）</Label>
            <Input
              id="runbook-context-ref"
              placeholder="project:<项目ID> 或 document:<文档ID>"
              value={contextRef}
              onChange={(event) => setContextRef(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="选择 Provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="runbook-model">模型 ID</Label>
            <Input
              id="runbook-model"
              placeholder="如 gpt-4o-mini"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button className="w-full" onClick={() => void handleGenerate()} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              生成 Runbook
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        ) : null}

        {data ? (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{data.primaryErrorType}</Badge>
                <span className="text-muted-foreground">错误类型：</span>
                {data.errorTypes.map((type) => (
                  <Badge key={type} variant="secondary">
                    {type}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-muted-foreground">
                已执行 {progress.done}/{progress.total} 步，失败 {progress.failed} 步。
              </p>
            </div>

            <RunbookList title="前置检查" items={data.template.precheck} />
            <RunbookList title="诊断步骤" items={data.template.diagnosis} />

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">恢复动作</h3>
              <div className="space-y-3">
                {data.template.recovery_actions.map((action) => {
                  const status = statuses[action.id] ?? "pending"
                  return (
                    <div key={action.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{ACTION_KIND_LABEL[action.kind]}</Badge>
                        <p className="font-medium">{action.title}</p>
                        <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p>动作：{action.action}</p>
                        <p>预期：{action.expected}</p>
                        <p>失败分支：{action.onFailure}</p>
                        <p>回退：{action.fallback}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void executeAction(action)}
                          disabled={executingActionId === action.id}
                        >
                          {executingActionId === action.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                          执行建议动作
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(action.id, "failed")}>标记执行失败</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(action.id, "pending")}>重置状态</Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <RunbookList title="验证步骤" items={data.template.verify} />
            <RunbookList title="升级条件" items={data.template.escalation} />
          </div>
        ) : null}

        {!loading && !data && !error ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            输入工单文本，或直接提供 Provider/模型/上下文标识后生成 Runbook。建议优先提供目标 Provider 与模型信息以提高建议精度。
          </div>
        ) : null}

        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> 已执行：表示动作完成且达到预期。</p>
          <p className="mt-1 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> 执行失败：表示动作已尝试但未达到预期。</p>
          <p className="mt-1 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> 连续失败建议触发升级条件。</p>
        </div>
      </CardContent>
    </Card>
  )
}

function RunbookList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">暂无条目</p> : null}
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  )
}
