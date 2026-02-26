"use client"

import { createContext, useContext } from "react"
import { useAIConfig } from "@/lib/ai/use-ai-config"
import type { AIProviderConfig } from "@/lib/ai/ai-config"

interface AIConfigContextType {
  config: AIProviderConfig | null
  isConfigured: boolean
  updateConfig: (config: AIProviderConfig) => void
  clearConfig: () => void
  getHeaders: () => Record<string, string>
}

const AIConfigContext = createContext<AIConfigContextType | null>(null)

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
  const aiConfig = useAIConfig()

  return (
    <AIConfigContext.Provider value={aiConfig}>
      {children}
    </AIConfigContext.Provider>
  )
}

export function useAIConfigContext() {
  const context = useContext(AIConfigContext)
  if (!context) {
    throw new Error("useAIConfigContext must be used within AIConfigProvider")
  }
  return context
}
