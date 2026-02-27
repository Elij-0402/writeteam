"use client"

import { useState, useCallback, useRef } from "react"
import type { ErrorClassification } from "@/lib/ai/error-classification"
import { parseAIError, parseFetchError } from "@/lib/ai/parse-ai-error"
import { createTemporaryConfig, buildConfigHeaders } from "@/lib/ai/ai-config"
import type { AIProviderConfig } from "@/lib/ai/ai-config"
import { toast } from "sonner"

interface AIRecoveryState {
  error: ErrorClassification | null
  isRetrying: boolean
}

interface UseAIRecoveryOptions {
  config: AIProviderConfig | null
  getHeaders: () => Record<string, string>
}

export function useAIRecovery({ config, getHeaders }: UseAIRecoveryOptions) {
  const [state, setState] = useState<AIRecoveryState>({
    error: null,
    isRetrying: false,
  })

  // Store the last failed request context for retry
  const lastRequestRef = useRef<{
    endpoint: string
    body: Record<string, unknown>
    onSuccess: (reader: ReadableStreamDefaultReader<Uint8Array>) => Promise<void>
  } | null>(null)

  const setError = useCallback((error: ErrorClassification | null) => {
    setState({ error, isRetrying: false })
  }, [])

  const clearError = useCallback(() => {
    setState({ error: null, isRetrying: false })
    lastRequestRef.current = null
  }, [])

  /**
   * Handle a failed AI response. Parses the error and sets recovery state.
   */
  const handleResponseError = useCallback(async (response: Response) => {
    const classification = await parseAIError(response)
    setState({ error: classification, isRetrying: false })
    return classification
  }, [])

  /**
   * Handle a fetch/network error. Parses the error and sets recovery state.
   */
  const handleFetchError = useCallback((error: unknown) => {
    const classification = parseFetchError(error)
    setState({ error: classification, isRetrying: false })
    return classification
  }, [])

  /**
   * Store request context for later retry.
   */
  const storeRequestContext = useCallback((
    endpoint: string,
    body: Record<string, unknown>,
    onSuccess: (reader: ReadableStreamDefaultReader<Uint8Array>) => Promise<void>
  ) => {
    lastRequestRef.current = { endpoint, body, onSuccess }
  }, [])

  /**
   * Retry the last failed request using current config headers.
   */
  const handleRetry = useCallback(async () => {
    const lastRequest = lastRequestRef.current
    if (!lastRequest) return

    setState((prev) => ({ ...prev, isRetrying: true }))

    try {
      const retryBody = { ...lastRequest.body, _isRetry: true, _recoveryType: "retry" as const }
      const response = await fetch(lastRequest.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify(retryBody),
      })

      if (!response.ok) {
        const classification = await parseAIError(response)
        setState({ error: classification, isRetrying: false })
        return
      }

      // Success — clear error and process stream
      setState({ error: null, isRetrying: false })
      const reader = response.body?.getReader()
      if (reader) {
        await lastRequest.onSuccess(reader)
      }
    } catch (error) {
      const classification = parseFetchError(error)
      setState({ error: classification, isRetrying: false })
    }
  }, [getHeaders])

  /**
   * Switch to a different model and retry. Does NOT modify global config.
   */
  const handleSwitchModel = useCallback(async (modelId: string, baseUrl?: string) => {
    const lastRequest = lastRequestRef.current
    if (!lastRequest || !config) return

    setState((prev) => ({ ...prev, isRetrying: true }))

    const tempConfig = createTemporaryConfig(config, { modelId, baseUrl })
    const tempHeaders = buildConfigHeaders(tempConfig)

    try {
      const switchBody = {
        ...lastRequest.body,
        _isRetry: true,
        _recoveryType: "switch" as const,
        _attemptedModel: modelId,
      }
      const response = await fetch(lastRequest.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tempHeaders },
        body: JSON.stringify(switchBody),
      })

      if (!response.ok) {
        const classification = await parseAIError(response)
        setState({ error: classification, isRetrying: false })
        return
      }

      // Success — clear error and process stream
      setState({ error: null, isRetrying: false })
      toast.success("已使用替代模型生成，如需永久切换请前往设置页。")
      const reader = response.body?.getReader()
      if (reader) {
        await lastRequest.onSuccess(reader)
      }
    } catch (error) {
      const classification = parseFetchError(error)
      setState({ error: classification, isRetrying: false })
    }
  }, [config])

  return {
    error: state.error,
    isRetrying: state.isRetrying,
    setError,
    clearError,
    handleResponseError,
    handleFetchError,
    storeRequestContext,
    handleRetry,
    handleSwitchModel,
  }
}
