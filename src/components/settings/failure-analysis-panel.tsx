"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type TimeRange = "24h" | "7d" | "30d"
type RecoveryStatus = "all" | "success" | "failure" | "recovered_retry" | "recovered_switch" | "unrecovered"

interface FailureAnalysisPayload {
  range: TimeRange
  summary: {
    totalCalls: number
    totalFailures: number
    failureRate: number
    affectedProjects: number
    affectedDocuments: number
    failureByDefinition: {
      recoveryStatusFailure: number
      errorTypeNonNull: number
      unionFailure: number
      recoveryStatusFailureRate: number
      errorTypeNonNullRate: number
    }
  }
  distributions: {
    byProvider: Array<{ provider: string; count: number }>
    byModel: Array<{ model: string; count: number }>
    byErrorType: Array<{ errorType: string; count: number }>
  }
  topFailureCombos: Array<{
    provider: string
    model: string
    errorType: string
    count: number
    nextActions: string[]
  }>
  recommendations: Array<{
    errorType: string
    title: string
    actions: string[]
  }>
  filters: {
    providers: string[]
    models: string[]
    errorTypes: string[]
    recoveryStatuses: string[]
  }
  notes: {
    providerRule: string
    failureRule: string
    truncated: string
  }
}

interface ErrorEnvelope {
  success: false
  error: {
    code: string
    message: string
  }
}

interface SuccessEnvelope {
  success: true
  data: FailureAnalysisPayload
}

type ApiEnvelope = ErrorEnvelope | SuccessEnvelope

const RANGE_OPTIONS: Array<{ value: TimeRange; label: string }> = [
  { value: "24h", label: "最近 24 小时" },
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" },
]

export function FailureAnalysisPanel() {
  const [range, setRange] = useState<TimeRange>("7d")
  const [provider, setProvider] = useState("all")
  const [model, setModel] = useState("all")
  const [errorType, setErrorType] = useState("all")
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>("all")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FailureAnalysisPayload | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      range,
      provider,
      model,
      errorType,
      recoveryStatus,
    })
    return params.toString()
  }, [range, provider, model, errorType, recoveryStatus])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/ai/failure-analysis?${queryString}`, {
        cache: "no-store",
      })
      const envelope = (await response.json()) as ApiEnvelope

      if (!response.ok || !envelope.success) {
        const message = envelope.success ? "失败分析加载失败" : envelope.error.message
        setError(message)
        setData(null)
        return
      }

      setData(envelope.data)
    } catch {
      setError("失败分析加载失败，请稍后重试")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    void load()
  }, [load])

  function handleClearFilters() {
    setRange("7d")
    setProvider("all")
    setModel("all")
    setErrorType("all")
    setRecoveryStatus("all")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>失败类型定位与影响范围分析</CardTitle>
        <CardDescription>按 provider、model、错误类型与时间维度分析失败分布，并提供可执行动作</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Select value={range} onValueChange={(value) => setRange(value as TimeRange)}>
            <SelectTrigger>
              <SelectValue placeholder="时间区间" />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部 Provider</SelectItem>
              {data?.filters.providers.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部模型</SelectItem>
              {data?.filters.models.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={errorType} onValueChange={setErrorType}>
            <SelectTrigger>
              <SelectValue placeholder="错误类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部错误类型</SelectItem>
              {data?.filters.errorTypes.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={recoveryStatus} onValueChange={(value) => setRecoveryStatus(value as RecoveryStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="恢复状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部恢复状态</SelectItem>
              {data?.filters.recoveryStatuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            清空筛选
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            刷新数据
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              数据加载失败
            </p>
            <p className="mt-1 text-muted-foreground">{error}</p>
          </div>
        ) : null}

        {!loading && !error && data && data.summary.totalFailures === 0 ? (
          <div className="rounded-md border p-4 text-sm">
            <p className="font-medium">当前筛选范围内没有失败记录</p>
            <p className="mt-1 text-muted-foreground">建议下一步：检查是否开启了错误遥测字段，并扩大时间范围观察趋势。</p>
          </div>
        ) : null}

        {!loading && !error && data && data.summary.totalFailures > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <MetricCard label="总调用" value={String(data.summary.totalCalls)} />
              <MetricCard label="失败总量" value={String(data.summary.totalFailures)} />
              <MetricCard label="失败率" value={`${data.summary.failureRate}%`} />
              <MetricCard label="受影响项目" value={String(data.summary.affectedProjects)} />
              <MetricCard label="受影响文档" value={String(data.summary.affectedDocuments)} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <DistributionCard
                title="Provider 分布"
                items={data.distributions.byProvider.map((item) => ({ label: item.provider, count: item.count }))}
              />
              <DistributionCard
                title="Model 分布"
                items={data.distributions.byModel.map((item) => ({ label: item.model, count: item.count }))}
              />
              <DistributionCard
                title="错误类型分布"
                items={data.distributions.byErrorType.map((item) => ({ label: item.errorType, count: item.count }))}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Top 失败组合与下一步动作</h3>
              <div className="grid grid-cols-1 gap-3">
                {data.topFailureCombos.map((combo) => (
                  <div key={`${combo.provider}-${combo.model}-${combo.errorType}`} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{combo.provider}</Badge>
                      <Badge variant="outline">{combo.model}</Badge>
                      <Badge>{combo.errorType}</Badge>
                      <span className="text-xs text-muted-foreground">失败 {combo.count} 次</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {combo.nextActions.map((action) => (
                        <li key={action}>- {action}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>{data.notes.providerRule}</p>
              <p className="mt-1">{data.notes.failureRule}</p>
              <p className="mt-1">{data.notes.truncated}</p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function DistributionCard({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; count: number }>
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? <p className="text-xs text-muted-foreground">暂无数据</p> : null}
        {items.slice(0, 5).map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="truncate pr-3">{item.label}</span>
            <Badge variant="secondary">{item.count}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
