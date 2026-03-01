import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { classifyHttpError, classifyNetworkError, AI_FETCH_TIMEOUT_MS } from "@/lib/ai/error-classification"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 })
  }

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置" }, { status: 400 })
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (aiConfig.apiKey) {
    headers["Authorization"] = `Bearer ${aiConfig.apiKey}`
  }

  const url = `${aiConfig.baseUrl.replace(/\/+$/, "")}/models`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, { headers, signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return Response.json(
        { error: classifyHttpError(response.status, "model-list") },
        { status: response.status >= 500 ? 502 : response.status }
      )
    }

    const data = await response.json()

    // Handle both { data: [...] } (OpenAI) and { models: [...] } (Ollama) and direct array formats
    const rawModels = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : Array.isArray(data) ? data : []

    const models = rawModels
      .filter((m: Record<string, unknown>) => typeof m.id === "string" && m.id)
      .map((m: Record<string, unknown>) => ({
        id: String(m.id),
        name: String(m.name || m.id),
        owned_by: String(m.owned_by || ""),
      }))

    return Response.json({ models })
  } catch (error) {
    clearTimeout(timeoutId)
    return Response.json(
      { error: classifyNetworkError(error) },
      { status: 502 }
    )
  }
}
