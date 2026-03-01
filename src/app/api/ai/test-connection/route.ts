import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { classifyHttpError, classifyNetworkError, AI_FETCH_TIMEOUT_MS } from "@/lib/ai/error-classification"

export async function POST(request: NextRequest) {
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

  const url = `${aiConfig.baseUrl.replace(/\/+$/, "")}/chat/completions`
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: aiConfig.modelId,
        messages: [
          { role: "user", content: "Hi" },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const latencyMs = Date.now() - startedAt

    if (!response.ok) {
      return Response.json({
        success: false,
        error: classifyHttpError(response.status, "connection-test"),
        latency_ms: latencyMs,
      })
    }

    const data = await response.json()
    const model = data.model || aiConfig.modelId

    return Response.json({ success: true, model, latency_ms: latencyMs })
  } catch (error) {
    clearTimeout(timeoutId)
    return Response.json({
      success: false,
      error: classifyNetworkError(error),
      latency_ms: Date.now() - startedAt,
    })
  }
}
