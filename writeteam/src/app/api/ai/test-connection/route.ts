import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"

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
    })

    const latencyMs = Date.now() - startedAt

    if (!response.ok) {
      const error = await response.text()
      return Response.json({ success: false, error: `连接失败: ${error}`, latency_ms: latencyMs })
    }

    const data = await response.json()
    const model = data.model || aiConfig.modelId

    return Response.json({ success: true, model, latency_ms: latencyMs })
  } catch (error) {
    return Response.json({
      success: false,
      error: `连接失败: ${error instanceof Error ? error.message : "未知错误"}`,
      latency_ms: Date.now() - startedAt,
    })
  }
}
