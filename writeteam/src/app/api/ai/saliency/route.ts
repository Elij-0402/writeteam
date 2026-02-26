import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { callOpenAIJson } from "@/lib/ai/openai-json"
import { fetchStoryContext } from "@/lib/ai/story-context"
import { computeSaliency } from "@/lib/ai/saliency"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未授权访问" }, { status: 401 })
  }

  const { text, projectId } = await request.json()

  if (!text || !projectId) {
    return Response.json({ error: "缺少必要参数" }, { status: 400 })
  }

  const storyCtx = await fetchStoryContext(supabase, projectId)

  // First compute heuristic saliency as a fast baseline
  const heuristicResult = computeSaliency(
    text,
    storyCtx.characters.map((c) => ({ name: c.name, role: c.role })),
    storyCtx.bible?.setting,
    storyCtx.bible?.worldbuilding
  )

  // Attempt AI-enhanced saliency analysis for richer results
  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    // Fall back to heuristic result when no AI config
    return Response.json(heuristicResult)
  }

  const characterNames = storyCtx.characters.map((c) => c.name).join("、")
  const settingInfo = storyCtx.bible?.setting || ""

  const systemPrompt = `你是一位专业的小说场景分析助手。你的任务是分析给定的文本片段，识别当前场景中活跃的元素。

请严格以 JSON 格式返回结果，不要包含任何其他文字。

返回格式：
{
  "activeCharacters": ["角色名1", "角色名2"],
  "activeLocations": ["地点1"],
  "activePlotlines": ["情节线1"]
}

规则：
- activeCharacters: 仅返回在文本中明确出场或被直接提及的角色名称
- activeLocations: 返回当前场景发生的地点
- activePlotlines: 返回当前正在推进的情节线（简要描述，最多 3 条）
- 所有数组如果没有匹配项则返回空数组`

  const userPrompt = `已知角色列表：${characterNames || "暂无"}
已知故事设定：${settingInfo || "暂无"}

请分析以下文本片段中的活跃元素：

${text.slice(-2000)}`

  const startedAt = Date.now()

  try {
    const result = await callOpenAIJson({
      ...aiConfig,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 500,
      temperature: 0.3,
    })

    if (result.error) {
      // Fall back to heuristic on API error
      return Response.json(heuristicResult)
    }

    const content = result.content

    // Log telemetry
    await supabase.from("ai_history").insert({
      user_id: user.id,
      project_id: projectId,
      document_id: null,
      feature: "saliency",
      prompt: userPrompt.slice(0, 500),
      result: content,
      model: aiConfig.modelId,
      tokens_used: estimateTokenCount(content),
      latency_ms: Date.now() - startedAt,
      output_chars: content.length,
      response_fingerprint: createTextFingerprint(content),
    })

    // Parse AI response
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim()
      const parsed = JSON.parse(cleaned)

      const result = {
        activeCharacters: Array.isArray(parsed.activeCharacters)
          ? parsed.activeCharacters.slice(0, 5)
          : heuristicResult.activeCharacters,
        activeLocations: Array.isArray(parsed.activeLocations)
          ? parsed.activeLocations.slice(0, 3)
          : heuristicResult.activeLocations,
        activePlotlines: Array.isArray(parsed.activePlotlines)
          ? parsed.activePlotlines.slice(0, 3)
          : heuristicResult.activePlotlines,
      }

      return Response.json(result)
    } catch {
      // JSON parse failed, fall back to heuristic
      return Response.json(heuristicResult)
    }
  } catch {
    // Network error, fall back to heuristic
    return Response.json(heuristicResult)
  }
}
