import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"

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

  try {
    const response = await fetch(url, { headers })

    if (!response.ok) {
      const error = await response.text()
      return Response.json({ error: `获取模型列表失败: ${error}` }, { status: 500 })
    }

    const data = await response.json()

    // Handle both { data: [...] } (OpenAI) and { models: [...] } formats
    const rawModels = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : Array.isArray(data) ? data : []

    const models = rawModels.map((m: Record<string, unknown>) => ({
      id: m.id as string,
      name: (m.name as string) || (m.id as string),
      owned_by: (m.owned_by as string) || "",
    }))

    return Response.json({ models })
  } catch (error) {
    return Response.json(
      { error: `连接失败: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    )
  }
}
