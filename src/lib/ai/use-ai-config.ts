"use client"

import { useState, useCallback } from "react"
import type { AIProviderConfig } from "@/lib/ai/ai-config"
import { AI_CONFIG_HEADERS, AI_CONFIG_STORAGE_KEY } from "@/lib/ai/ai-config"

function readStoredConfig(): AIProviderConfig | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(AI_CONFIG_STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    localStorage.removeItem(AI_CONFIG_STORAGE_KEY)
  }
  return null
}

export function useAIConfig() {
  const [config, setConfig] = useState<AIProviderConfig | null>(readStoredConfig)

  const isConfigured = config !== null

  const updateConfig = useCallback((newConfig: AIProviderConfig) => {
    setConfig(newConfig)
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(newConfig))
  }, [])

  const clearConfig = useCallback(() => {
    setConfig(null)
    localStorage.removeItem(AI_CONFIG_STORAGE_KEY)
  }, [])

  const getHeaders = useCallback((): Record<string, string> => {
    if (!config) return {}
    return {
      [AI_CONFIG_HEADERS.BASE_URL]: config.baseUrl,
      [AI_CONFIG_HEADERS.API_KEY]: config.apiKey,
      [AI_CONFIG_HEADERS.MODEL_ID]: config.modelId,
    }
  }, [config])

  return { config, isConfigured, updateConfig, clearConfig, getHeaders }
}
