import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAIConfig } from "@/lib/ai/resolve-config"
import { callOpenAIJson } from "@/lib/ai/openai-json"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"

type CanvasBeat = {
  label: string
  content: string
  type: string
}

const ALLOWED_CANVAS_NODE_TYPES = new Set(["beat", "scene", "character", "location", "note"])

function cleanAIJson(content: string): string {
  return content.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim()
}

function normalizeBeat(rawBeat: unknown): CanvasBeat | null {
  if (!rawBeat || typeof rawBeat !== "object") {
    return null
  }

  const candidate = rawBeat as { label?: unknown; content?: unknown; type?: unknown }
  const label = typeof candidate.label === "string" ? candidate.label.trim() : ""
  const content = typeof candidate.content === "string" ? candidate.content.trim() : ""
  const rawType = typeof candidate.type === "string" ? candidate.type.trim() : ""
  const type = rawType && ALLOWED_CANVAS_NODE_TYPES.has(rawType) ? rawType : "beat"

  if (!label || !content) {
    return null
  }

  return {
    label: label.slice(0, 60),
    content: content.slice(0, 500),
    type,
  }
}

function parseBeats(content: string): { beats?: CanvasBeat[]; error?: string } {
  try {
    const parsed = JSON.parse(cleanAIJson(content)) as unknown
    if (!Array.isArray(parsed)) {
      return { error: "AI 返回格式错误：结果不是数组" }
    }

    const beats = parsed
      .map(normalizeBeat)
      .filter((beat): beat is CanvasBeat => beat !== null)

    if (beats.length === 0) {
      return { error: "AI 未生成可用节拍，请重试或调整大纲后再试" }
    }

    return { beats: beats.slice(0, 12) }
  } catch {
    return { error: "AI 返回格式错误，请重试" }
  }
}

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

  let body: { projectId?: unknown; outline?: unknown }
  try {
    body = await request.json() as { projectId?: unknown; outline?: unknown }
  } catch {
    return Response.json({ error: "请求格式错误，请检查输入后重试" }, { status: 400 })
  }
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
  const outline = typeof body.outline === "string" ? body.outline.trim() : ""

  if (!projectId) {
    return Response.json({ error: "缺少项目ID，请返回项目后重试" }, { status: 400 })
  }

  if (!outline) {
    return Response.json({ error: "未提供大纲内容" }, { status: 400 })
  }

  if (outline.length < 10) {
    return Response.json({ error: "大纲内容过短，请补充更多剧情信息后重试" }, { status: 400 })
  }

  const startedAt = Date.now()

  const storyCtx = await fetchStoryContext(supabase, projectId, user.id)
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

    const parsed = parseBeats(content)
    if (parsed.error || !parsed.beats) {
      return Response.json({ error: parsed.error ?? "AI 生成失败" }, { status: 500 })
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

    return Response.json({ beats: parsed.beats })
  } catch {
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
