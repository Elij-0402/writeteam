import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { callOpenAIJson } from "@/lib/ai/openai-json"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未授权访问" }, { status: 401 })
  }

  const aiConfig = resolveAIConfig(request)
  if (!aiConfig) {
    return Response.json({ error: "AI 服务未配置" }, { status: 400 })
  }

  const { projectId, outline } = await request.json()

  if (!outline) {
    return Response.json({ error: "未提供大纲内容" }, { status: 400 })
  }

  const startedAt = Date.now()

  const storyCtx = await fetchStoryContext(supabase, projectId)
  const { fullContext } = buildStoryPromptContext(storyCtx, { feature: "canvas-generate" })

  let systemPrompt = `You are a story structure expert. Your task is to analyze an outline or synopsis and break it down into story beats — the essential narrative moments that drive the plot forward.

Return ONLY a valid JSON array of beat objects. Each beat should have:
- "label": A short, descriptive title for the beat (5-10 words)
- "content": A 1-2 sentence description of what happens in this beat
- "type": Always "beat"

Generate 6-12 beats depending on the complexity of the outline. Order them chronologically.

IMPORTANT: Return ONLY the JSON array. No markdown, no code fences, no explanations.`

  if (fullContext) {
    systemPrompt += `\n\n${fullContext}`
  }

  const userPrompt = `Analyze this outline and generate story beat nodes:\n\n${outline.slice(0, 5000)}`

  try {
    const result = await callOpenAIJson({
      ...aiConfig,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 2000,
      temperature: 0.7,
    })

    if (result.error) {
      return Response.json({ error: result.error }, { status: 500 })
    }

    const content = result.content

    // Parse the JSON from the response, handling possible markdown fences
    let beats: Array<{ label: string; content: string; type: string }>
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      beats = JSON.parse(cleaned)
    } catch {
      return Response.json(
        { error: "AI 返回格式错误，请重试" },
        { status: 500 }
      )
    }

    // Log to ai_history
    await supabase.from("ai_history").insert({
      user_id: user.id,
      project_id: projectId,
      document_id: null,
      feature: "canvas-generate",
      prompt: outline.slice(0, 500),
      result: content,
      model: aiConfig.modelId,
      tokens_used: estimateTokenCount(content),
      latency_ms: Date.now() - startedAt,
      output_chars: content.length,
      response_fingerprint: createTextFingerprint(content),
    })

    return Response.json({ beats })
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
