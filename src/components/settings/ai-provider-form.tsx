"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
import {
  Loader2,
  Eye,
  EyeOff,
  Check,
  ChevronsUpDown,
  Trash2,
  Server,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAIConfigContext } from "@/components/providers/ai-config-provider"
import {
  formatBaseUrl,
  suggestBaseUrl,
  resolveProviderNameByBaseUrl,
} from "@/lib/ai/ai-config"
import type { AIProviderConfig } from "@/lib/ai/ai-config"

interface ModelOption {
  id: string
  name: string
  owned_by: string
}

interface AIProviderFormProps {
  variant?: "full" | "compact"
}

export function AIProviderForm({ variant = "full" }: AIProviderFormProps) {
  const { config, isConfigured, updateConfig, clearConfig } = useAIConfigContext()

  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || "")
  const [apiKey, setApiKey] = useState(config?.apiKey || "")
  const [modelId, setModelId] = useState(config?.modelId || "")
  const [modelName, setModelName] = useState(config?.modelName || "")

  const [showApiKey, setShowApiKey] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [connectionWarning, setConnectionWarning] = useState(false)
  const [urlSuggestions, setUrlSuggestions] = useState<string[]>([])
  const [modelSearchValue, setModelSearchValue] = useState("")
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const fetchModels = useCallback(async (url: string, key: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setModelsLoading(true)
    try {
      const response = await fetch("/api/ai/models", {
        headers: {
          "X-AI-Base-URL": url,
          "X-AI-API-Key": key,
          "X-AI-Model-ID": "placeholder",
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        setModels([])
        return
      }

      const data = await response.json()
      setModels(data.models || [])
    } catch {
      // Silent fallback — user can manually input model ID
      if (!controller.signal.aborted) {
        setModels([])
      }
    } finally {
      if (!controller.signal.aborted) {
        setModelsLoading(false)
      }
    }
  }, [])

  // Auto-fetch models when baseUrl changes (500ms debounce)
  useEffect(() => {
    if (fetchDebounceRef.current) {
      clearTimeout(fetchDebounceRef.current)
    }

    const formatted = baseUrl.trim() ? formatBaseUrl(baseUrl) : ""
    if (!formatted) {
      setModels([])
      return
    }

    fetchDebounceRef.current = setTimeout(() => {
      fetchModels(formatted, apiKey)
    }, 500)

    return () => {
      if (fetchDebounceRef.current) {
        clearTimeout(fetchDebounceRef.current)
      }
      abortControllerRef.current?.abort()
    }
  }, [baseUrl, apiKey, fetchModels])

  function handleBaseUrlChange(value: string) {
    setBaseUrl(value)
    setUrlSuggestions(suggestBaseUrl(value))
  }

  function handleSuggestionClick(url: string) {
    setBaseUrl(url)
    setUrlSuggestions([])
  }

  function handleBaseUrlBlur() {
    const formatted = formatBaseUrl(baseUrl)
    if (formatted !== baseUrl) {
      setBaseUrl(formatted)
    }
    setUrlSuggestions([])
  }

  async function handleSave() {
    if (!baseUrl || !modelId) {
      toast.error("请填写 Base URL 并选择模型")
      return
    }

    setSaving(true)
    const formattedUrl = formatBaseUrl(baseUrl)

    const newConfig: AIProviderConfig = {
      baseUrl: formattedUrl,
      apiKey,
      modelId,
      modelName: modelName || modelId,
      configuredAt: Date.now(),
    }

    updateConfig(newConfig)

    // Auto test connection
    try {
      const response = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Base-URL": formattedUrl,
          "X-AI-API-Key": apiKey,
          "X-AI-Model-ID": modelId,
        },
      })

      if (!mountedRef.current) return
      const data = await response.json()

      if (data.success) {
        setConnectionWarning(false)
        toast.success("配置已保存")
      } else {
        setConnectionWarning(true)
        toast.error(data.error || "连接测试失败，配置已保存但连接未验证")
      }
    } catch {
      if (!mountedRef.current) return
      setConnectionWarning(true)
      toast.error("连接测试失败，配置已保存但连接未验证")
    } finally {
      if (mountedRef.current) {
        setSaving(false)
      }
    }
  }

  function handleClear() {
    clearConfig()
    setBaseUrl("")
    setApiKey("")
    setModelId("")
    setModelName("")
    setModels([])
    setConnectionWarning(false)
    setUrlSuggestions([])
    toast.success("AI 配置已清除")
  }

  const isCompact = variant === "compact"
  const spacingClass = isCompact ? "space-y-3" : "space-y-6"

  const formContent = (
    <div className={spacingClass}>
      {/* Base URL */}
      <div className="space-y-2">
        <Label htmlFor="base-url">Base URL</Label>
        <Input
          id="base-url"
          placeholder="https://api.deepseek.com/v1"
          value={baseUrl}
          onChange={(e) => handleBaseUrlChange(e.target.value)}
          onBlur={handleBaseUrlBlur}
        />
        {urlSuggestions.length > 0 && (
          <div className="rounded-md border bg-popover text-popover-foreground shadow-sm">
            {urlSuggestions.map((url) => (
              <button
                key={url}
                type="button"
                className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleSuggestionClick(url)}
              >
                {url}
              </button>
            ))}
          </div>
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

      {/* Model */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>模型</Label>
          {modelsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        {models.length > 0 ? (
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
                  <span className="text-muted-foreground">选择模型...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="搜索或输入模型 ID..."
                  value={modelSearchValue}
                  onValueChange={setModelSearchValue}
                />
                <CommandList>
                  <CommandEmpty>
                    {modelSearchValue.trim() ? (
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          setModelId(modelSearchValue.trim())
                          setModelName(modelSearchValue.trim())
                          setModelSearchValue("")
                          setModelOpen(false)
                        }}
                      >
                        使用 &quot;{modelSearchValue.trim()}&quot;
                      </button>
                    ) : (
                      <p className="py-2 text-sm text-muted-foreground">
                        未找到匹配模型，可直接在搜索框输入模型 ID
                      </p>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {models.map((model) => (
                      <CommandItem
                        key={model.id}
                        value={model.id}
                        onSelect={() => {
                          setModelId(model.id)
                          setModelName(model.name)
                          setModelSearchValue("")
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
        ) : (
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

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={!baseUrl || !modelId || saving}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          保存配置
        </Button>
        {isConfigured && (
          <Button variant="destructive" size="icon" onClick={handleClear}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Config Summary (full variant only) */}
      {variant === "full" && isConfigured && config && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <Server className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{config.modelName || config.modelId}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{resolveProviderNameByBaseUrl(config.baseUrl)}</span>
          {connectionWarning && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3" />
                连接未验证
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )

  if (isCompact) {
    return formContent
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <CardTitle>AI 模型配置</CardTitle>
        </div>
        <CardDescription>
          配置你自己的 AI 服务（支持 DeepSeek、OpenAI、Ollama、中转站等 OpenAI 兼容接口）
        </CardDescription>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  )
}
