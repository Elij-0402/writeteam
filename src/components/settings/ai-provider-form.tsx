"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Eye,
  EyeOff,
  Check,
  ChevronsUpDown,
  Trash2,
  Zap,
  Server,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"
import { PROVIDER_PRESETS } from "@/lib/ai/ai-config"
import type { AIProviderConfig } from "@/lib/ai/ai-config"

interface ModelOption {
  id: string
  name: string
  owned_by: string
}

function normalizeBaseUrl(raw: string): string {
  let url = raw.trim()
  if (!url) return url
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }
  // Remove trailing slash
  url = url.replace(/\/+$/, "")
  // Append /v1 if not present
  if (!/\/v\d+$/.test(url)) {
    url = `${url}/v1`
  }
  return url
}

export function AIProviderForm() {
  const { config, isConfigured, updateConfig, clearConfig } = useAIConfigContext()

  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || "")
  const [apiKey, setApiKey] = useState(config?.apiKey || "")
  const [modelId, setModelId] = useState(config?.modelId || "")
  const [modelName, setModelName] = useState(config?.modelName || "")

  const [showApiKey, setShowApiKey] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; model?: string; latency_ms?: number; error?: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")

  function handleBaseUrlBlur() {
    const normalized = normalizeBaseUrl(baseUrl)
    setBaseUrl(normalized)
    setPreviewUrl(normalized)
  }

  function handlePresetClick(presetUrl: string) {
    setBaseUrl(presetUrl)
    setPreviewUrl(presetUrl)
  }

  async function handleFetchModels() {
    if (!baseUrl) {
      toast.error("请先输入 Base URL")
      return
    }

    setModelsLoading(true)
    setModels([])

    try {
      const response = await fetch("/api/ai/models", {
        headers: {
          "X-AI-Base-URL": normalizeBaseUrl(baseUrl),
          "X-AI-API-Key": apiKey,
          "X-AI-Model-ID": modelId || "placeholder",
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "获取模型列表失败")
      }

      const data = await response.json()
      setModels(data.models || [])

      if (data.models?.length > 0) {
        toast.success(`获取到 ${data.models.length} 个模型`)
      } else {
        toast.error("未获取到任何模型")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取模型列表失败")
    } finally {
      setModelsLoading(false)
    }
  }

  async function handleTestConnection() {
    if (!baseUrl || !modelId) {
      toast.error("请先填写 Base URL 并选择模型")
      return
    }

    setTestLoading(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Base-URL": normalizeBaseUrl(baseUrl),
          "X-AI-API-Key": apiKey,
          "X-AI-Model-ID": modelId,
        },
      })

      const data = await response.json()
      setTestResult(data)

      if (data.success) {
        toast.success(`连接成功！延迟 ${data.latency_ms}ms`)
      } else {
        toast.error(data.error || "连接测试失败")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "连接测试失败")
    } finally {
      setTestLoading(false)
    }
  }

  function handleSave() {
    if (!baseUrl || !modelId) {
      toast.error("请填写 Base URL 并选择模型")
      return
    }

    const newConfig: AIProviderConfig = {
      baseUrl: normalizeBaseUrl(baseUrl),
      apiKey,
      modelId,
      modelName: modelName || modelId,
      configuredAt: Date.now(),
    }

    updateConfig(newConfig)
    toast.success("AI 配置已保存")
  }

  function handleClear() {
    clearConfig()
    setBaseUrl("")
    setApiKey("")
    setModelId("")
    setModelName("")
    setModels([])
    setTestResult(null)
    setPreviewUrl("")
    toast.success("AI 配置已清除")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle>AI 模型配置</CardTitle>
          </div>
          {isConfigured ? (
            <Badge variant="default" className="gap-1">
              <Check className="h-3 w-3" />
              已配置
            </Badge>
          ) : (
            <Badge variant="secondary">未配置</Badge>
          )}
        </div>
        <CardDescription>
          配置你自己的 AI 服务（支持 DeepSeek、OpenAI、Ollama、中转站等 OpenAI 兼容接口）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Presets */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">常用服务商</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                variant={baseUrl === preset.baseUrl ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handlePresetClick(preset.baseUrl)}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label htmlFor="base-url">Base URL</Label>
          <Input
            id="base-url"
            placeholder="https://api.deepseek.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            onBlur={handleBaseUrlBlur}
          />
          {previewUrl && previewUrl !== baseUrl && (
            <p className="text-xs text-muted-foreground">
              将使用: {previewUrl}
            </p>
          )}
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="api-key">API Key</Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showApiKey ? "text" : "password"}
              placeholder="sk-... (Ollama 可留空)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-10"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Fetch Models */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>模型</Label>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleFetchModels}
              disabled={modelsLoading || !baseUrl}
            >
              {modelsLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Server className="h-3 w-3" />
              )}
              获取模型列表
            </Button>
          </div>

          {/* Model Combobox */}
          <Popover open={modelOpen} onOpenChange={setModelOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={modelOpen}
                className="w-full justify-between font-normal"
              >
                {modelId ? (
                  <span>{modelName || modelId}</span>
                ) : (
                  <span className="text-muted-foreground">选择模型或手动输入...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="搜索或手动输入模型 ID..."
                  onValueChange={(value) => {
                    if (value && !models.find((m) => m.id === value)) {
                      setModelId(value)
                      setModelName(value)
                    }
                  }}
                />
                <CommandList>
                  <CommandEmpty>
                    <p className="py-2 text-sm text-muted-foreground">
                      未找到匹配模型，可直接在搜索框输入模型 ID
                    </p>
                  </CommandEmpty>
                  <CommandGroup>
                    {models.map((model) => (
                      <CommandItem
                        key={model.id}
                        value={model.id}
                        onSelect={() => {
                          setModelId(model.id)
                          setModelName(model.name)
                          setModelOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            modelId === model.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm">{model.name || model.id}</span>
                          {model.owned_by && (
                            <span className="text-xs text-muted-foreground">{model.owned_by}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Manual model ID input */}
          {models.length === 0 && (
            <Input
              placeholder="手动输入模型 ID，如 deepseek-chat"
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value)
                setModelName(e.target.value)
              }}
            />
          )}
        </div>

        {/* Test Connection */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full gap-1.5"
            onClick={handleTestConnection}
            disabled={testLoading || !baseUrl || !modelId}
          >
            {testLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            测试连接
          </Button>

          {testResult && (
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                testResult.success
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              )}
            >
              {testResult.success ? (
                <span>连接成功 — 模型: {testResult.model}，延迟: {testResult.latency_ms}ms</span>
              ) : (
                <span>{testResult.error}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!baseUrl || !modelId}
          >
            保存配置
          </Button>
          {isConfigured && (
            <Button variant="destructive" size="icon" onClick={handleClear}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Current Config Summary */}
        {isConfigured && config && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <p><span className="text-muted-foreground">Base URL:</span> {config.baseUrl}</p>
            <p><span className="text-muted-foreground">模型:</span> {config.modelName || config.modelId}</p>
            <p><span className="text-muted-foreground">配置时间:</span> {new Date(config.configuredAt).toLocaleString("zh-CN")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
