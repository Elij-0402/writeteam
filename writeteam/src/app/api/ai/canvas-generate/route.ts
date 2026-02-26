import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchStoryContext, buildStoryPromptContext } from "@/lib/ai/story-context"
import { createTextFingerprint, estimateTokenCount } from "@/lib/ai/telemetry"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "未授权访问" }, { status: 401 })
  }

  const { projectId, outline } = await request.json()

  if (!outline) {
    return Response.json({ error: "未提供大纲内容" }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: "OpenAI API Key 未配置" }, { status: 500 })
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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return Response.json({ error: `OpenAI error: ${error}` }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""

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
      model: "gpt-4o-mini",
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
